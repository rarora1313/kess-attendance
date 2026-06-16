import { useState, useEffect, useRef } from 'react';
import { kioskAction, getEmployeeStatus, kioskSubmitTimesheet } from '../../api';
import { useAuth } from '../../context/AuthContext';

type KioskState = 'idle' | 'identified' | 'success' | 'logTask' | 'taskDone' | 'error';

interface EmployeeStatus {
  employee: { firstName: string; lastName: string };
  clockedIn: boolean;
  onBreak: boolean;
}

const NUMPAD_KEYS = ['1','2','3','4','5','6','7','8','9','⌫','0','→'];

export default function Kiosk() {
  const { user } = useAuth();
  const [pin, setPin] = useState('');
  const [state, setState] = useState<KioskState>('idle');
  const [empStatus, setEmpStatus] = useState<EmployeeStatus | null>(null);
  const [message, setMessage] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [clock, setClock] = useState(new Date());
  const [cameraReady, setCameraReady] = useState(false);
  const [shiftHours, setShiftHours] = useState<number | null>(null);
  const [taskForm, setTaskForm] = useState({ taskName: '', hoursWorked: '', description: '' });
  const [taskError, setTaskError] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (state === 'success' || state === 'taskDone') {
      const t = setTimeout(resetToIdle, 5000);
      return () => clearTimeout(t);
    }
  }, [state]);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setCameraReady(true);
      }
    } catch { /* Camera unavailable */ }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
  }

  function snapPhoto(): string | null {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraReady || video.videoWidth === 0) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85);
  }

  function resetToIdle() {
    setState('idle');
    setPin('');
    setEmpStatus(null);
    setCapturedPhoto(null);
    setShiftHours(null);
    setTaskForm({ taskName: '', hoursWorked: '', description: '' });
    setTaskError('');
  }

  function handleNumpad(key: string) {
    if (key === '⌫') { setPin(p => p.slice(0, -1)); }
    else if (key === '→') { handlePinSubmit(); }
    else if (pin.length < 10) { setPin(p => p + key); }
  }

  async function handlePinSubmit() {
    if (!pin) return;
    try {
      const s = await getEmployeeStatus(pin);
      setEmpStatus(s);
      setState('identified');
    } catch {
      setMessage('PIN not recognised. Please try again.');
      setState('error');
    }
  }

  async function handleAction(action: string) {
    const photo = snapPhoto();
    setCapturedPhoto(photo);
    try {
      const result = await kioskAction(pin, action, user?.branchId, photo);

      if (action === 'clockOut') {
        const hours = result.totalHours ?? null;
        setShiftHours(hours);
        setTaskForm(f => ({ ...f, hoursWorked: hours ? String(hours) : '' }));
        setState('logTask');
      } else {
        const labels: Record<string, string> = {
          clockIn:    `Welcome, ${empStatus?.employee.firstName}! You are now signed in.`,
          breakStart: 'Break started. Enjoy your break!',
          breakEnd:   `Welcome back, ${empStatus?.employee.firstName}!`,
        };
        setMessage(labels[action] ?? 'Done!');
        setState('success');
      }
    } catch (err: any) {
      setMessage(err.response?.data?.error ?? 'Something went wrong.');
      setState('error');
    }
  }

  async function handleTaskSubmit() {
    if (!taskForm.taskName || !taskForm.hoursWorked) {
      setTaskError('Please enter task name and hours.');
      return;
    }
    try {
      await kioskSubmitTimesheet({
        pin,
        taskName: taskForm.taskName,
        hoursWorked: taskForm.hoursWorked,
        description: taskForm.description,
        date: new Date().toISOString().slice(0, 10),
      });
      setState('taskDone');
    } catch {
      setTaskError('Could not submit. Please try again.');
    }
  }

  const timeStr = clock.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = clock.toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const hideCamera = state === 'logTask' || state === 'taskDone';

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-rose-700 flex flex-col items-center justify-center p-4">

      <div className="text-center text-white mb-5">
        <p className="text-2xl font-bold tracking-wide text-white drop-shadow">Kess Hair & Beauty</p>
        <p className="text-sm font-medium text-pink-200 mb-3 tracking-widest uppercase">Botany Branch</p>
        <p className="text-5xl font-light tabular-nums">{timeStr}</p>
        <p className="text-lg text-blue-200 mt-1">{dateStr}</p>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Camera — hidden on task form screens */}
        {!hideCamera && (
          <div className="relative bg-gray-900 w-full aspect-video overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted
              className={`w-full h-full object-cover ${capturedPhoto ? 'hidden' : 'block'}`} />
            {capturedPhoto && (
              <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover" />
            )}
            {!cameraReady && !capturedPhoto && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                Camera not available
              </div>
            )}
            {!capturedPhoto && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 320 240" preserveAspectRatio="xMidYMid slice">
                <defs>
                  <mask id="ovalMask">
                    <rect width="320" height="240" fill="white" />
                    <ellipse cx="160" cy="118" rx="88" ry="108" fill="black" />
                  </mask>
                </defs>
                <rect width="320" height="240" fill="rgba(0,0,0,0.45)" mask="url(#ovalMask)" />
                <ellipse cx="160" cy="118" rx="88" ry="108" fill="none"
                  stroke="white" strokeWidth="2.5" strokeDasharray="6 4" opacity="0.85" />
              </svg>
            )}
          </div>
        )}

        <div className="p-5">

          {/* IDLE — numpad */}
          {state === 'idle' && (
            <>
              <div className="flex justify-center gap-3 mb-5 h-8 items-center">
                {pin.length === 0
                  ? <p className="text-gray-300 text-sm tracking-widest">Enter PIN</p>
                  : Array.from({ length: pin.length }).map((_, i) => (
                      <span key={i} className="w-3 h-3 rounded-full bg-blue-600 block" />
                    ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {NUMPAD_KEYS.map(key => (
                  <button key={key} onClick={() => handleNumpad(key)}
                    className={`py-4 rounded-xl text-xl font-semibold transition-all active:scale-95 select-none
                      ${key === '→' ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : key === '⌫' ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        : 'bg-gray-50 text-gray-800 hover:bg-gray-100 border border-gray-200'}`}>
                    {key}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* IDENTIFIED — action buttons */}
          {state === 'identified' && empStatus && (
            <>
              <div className="text-center mb-5">
                <h2 className="text-xl font-bold text-gray-800">Hi, {empStatus.employee.firstName}!</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {empStatus.clockedIn
                    ? empStatus.onBreak ? 'You are on a break.' : 'You are signed in.'
                    : 'You are not signed in.'}
                </p>
              </div>
              <div className="space-y-2">
                {!empStatus.clockedIn && (
                  <button onClick={() => handleAction('clockIn')}
                    className="w-full py-4 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors text-lg">
                    Sign In
                  </button>
                )}
                {empStatus.clockedIn && !empStatus.onBreak && (
                  <button onClick={() => handleAction('breakStart')}
                    className="w-full py-3 bg-yellow-500 text-white font-semibold rounded-xl hover:bg-yellow-600 transition-colors">
                    Start Break
                  </button>
                )}
                {empStatus.clockedIn && empStatus.onBreak && (
                  <button onClick={() => handleAction('breakEnd')}
                    className="w-full py-3 bg-yellow-500 text-white font-semibold rounded-xl hover:bg-yellow-600 transition-colors">
                    End Break
                  </button>
                )}
                {empStatus.clockedIn && (
                  <button onClick={() => handleAction('clockOut')}
                    className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors text-lg">
                    Sign Out
                  </button>
                )}
                <button onClick={resetToIdle}
                  className="w-full py-2 text-gray-400 text-sm hover:text-gray-600 transition-colors">
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* SUCCESS — sign in / break */}
          {state === 'success' && (
            <div className="text-center py-3">
              <div className="text-4xl mb-2">✓</div>
              <p className="text-base font-semibold text-green-700">{message}</p>
              <p className="text-xs text-gray-400 mt-2">Returning in 5 seconds…</p>
            </div>
          )}

          {/* LOG TASK — after sign out */}
          {state === 'logTask' && (
            <>
              <div className="text-center mb-4">
                <div className="text-3xl mb-1">✓</div>
                <p className="font-semibold text-green-700">
                  Goodbye, {empStatus?.employee.firstName}!
                </p>
                <p className="text-sm text-gray-500 mt-2 font-medium">
                  Log your tasks for today
                </p>
                {shiftHours && (
                  <p className="text-xs text-gray-400 mt-1">
                    Shift duration: {shiftHours}h
                  </p>
                )}
              </div>

              {taskError && (
                <p className="text-red-500 text-xs mb-3 text-center">{taskError}</p>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Task Name *</label>
                  <input
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                    placeholder="e.g. Customer service, Restocking..."
                    value={taskForm.taskName}
                    onChange={e => setTaskForm(f => ({ ...f, taskName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Hours Worked *</label>
                  <input
                    type="number" step="0.25" min="0" max="24"
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                    placeholder="e.g. 4.5"
                    value={taskForm.hoursWorked}
                    onChange={e => setTaskForm(f => ({ ...f, hoursWorked: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description (optional)</label>
                  <textarea
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 resize-none"
                    rows={2}
                    placeholder="Any notes about your work today..."
                    value={taskForm.description}
                    onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button onClick={handleTaskSubmit}
                  className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-sm">
                  Submit
                </button>
                <button onClick={resetToIdle}
                  className="flex-1 py-3 border-2 border-gray-200 text-gray-500 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm">
                  Skip
                </button>
              </div>
            </>
          )}

          {/* TASK DONE */}
          {state === 'taskDone' && (
            <div className="text-center py-6">
              <div className="text-4xl mb-2">📋</div>
              <p className="font-semibold text-blue-700">Timesheet submitted!</p>
              <p className="text-sm text-gray-500 mt-1">Your manager will review it shortly.</p>
              <p className="text-xs text-gray-400 mt-3">Returning in 5 seconds…</p>
            </div>
          )}

          {/* ERROR */}
          {state === 'error' && (
            <div className="text-center py-3">
              <div className="text-4xl mb-2">✗</div>
              <p className="text-base font-semibold text-red-600">{message}</p>
              <button onClick={resetToIdle} className="mt-3 text-sm text-blue-600 hover:underline">
                Try again
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="mt-5 text-pink-300 text-xs">
        <a href="/login" className="underline">Admin / Manager Login</a>
      </p>
    </div>
  );
}
