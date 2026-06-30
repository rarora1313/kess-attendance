import { useState, useEffect, useRef } from 'react';
import { kioskAction, getEmployeeStatus, kioskSubmitTimesheet } from '../../api';
import { useAuth } from '../../context/AuthContext';

type KioskState = 'idle' | 'identified' | 'success' | 'clockOutSummary' | 'logTask' | 'taskDone' | 'error';

interface EmployeeStatus {
  employee: { firstName: string; lastName: string };
  clockedIn: boolean;
  onBreak: boolean;
  missedSignOut: string | null;
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
  const [clockOutInfo, setClockOutInfo] = useState<{ clockInTime: string; clockOutTime: string; breakMinutes: number } | null>(null);
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
    if (state === 'success') {
      const t = setTimeout(resetToIdle, 5000);
      return () => clearTimeout(t);
    }
    if (state === 'taskDone') {
      const t = setTimeout(resetToIdle, 3000);
      return () => clearTimeout(t);
    }
  }, [state]);

  useEffect(() => {
    if (state === 'clockOutSummary') {
      const t = setTimeout(() => setState('logTask'), 6000);
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
    setClockOutInfo(null);
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
        setClockOutInfo({
          clockInTime: result.clockInTime,
          clockOutTime: result.clockOutTime,
          breakMinutes: result.totalBreakMinutes ?? 0,
        });
        setState('clockOutSummary');
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
    if (!taskForm.hoursWorked) {
      setTaskError('Please enter hours worked.');
      return;
    }
    try {
      await kioskSubmitTimesheet({
        pin,
        taskName: 'Shift',
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
  const hideCamera = state === 'logTask' || state === 'taskDone' || state === 'clockOutSummary';

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-gray-900 via-gray-700 to-orange-600 flex flex-col items-center justify-center p-2">

      <div className="flex items-center justify-center gap-5 text-white mb-2 w-full max-w-sm">
        {/* Kess Hair & Beauty Logo */}
        <div className="flex flex-col items-center">
          <div className="bg-white rounded-xl px-4 py-2 shadow-lg">
            <div className="flex items-center justify-center gap-0">
              <span style={{ color: '#F7941D', fontWeight: 900, fontSize: '1.6rem', fontFamily: 'Arial Black, sans-serif', letterSpacing: '-1px' }}>k</span>
              <div className="flex flex-col justify-center gap-0.5 mx-1" style={{ marginTop: '2px' }}>
                <div style={{ width: '22px', height: '3px', backgroundColor: '#888', borderRadius: '2px' }}></div>
                <div style={{ width: '22px', height: '3px', backgroundColor: '#888', borderRadius: '2px' }}></div>
                <div style={{ width: '22px', height: '3px', backgroundColor: '#888', borderRadius: '2px' }}></div>
              </div>
              <span style={{ color: '#F7941D', fontWeight: 900, fontSize: '1.6rem', fontFamily: 'Arial Black, sans-serif', letterSpacing: '-1px' }}>ss</span>
            </div>
            <div style={{ borderTop: '2px solid #F7941D', marginTop: '2px', paddingTop: '2px' }}>
              <p style={{ color: '#555', fontSize: '0.6rem', letterSpacing: '3px', textAlign: 'center', fontWeight: 500 }}>hair and beauty</p>
            </div>
          </div>
          <p className="text-xs font-medium text-orange-200 mt-1 tracking-widest uppercase">Botany</p>
        </div>
        {/* Clock */}
        <div className="text-center">
          <p className="text-4xl font-light tabular-nums">{timeStr}</p>
          <p className="text-sm text-orange-100">{dateStr}</p>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Camera — hidden on task form screens */}
        {!hideCamera && (
          <div className="relative bg-gray-900 w-full overflow-hidden" style={{ height: '220px' }}>
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

        <div className="p-3">

          {/* IDLE — numpad */}
          {state === 'idle' && (
            <>
              <div className="flex justify-center gap-3 mb-3 h-7 items-center">
                {pin.length === 0
                  ? <p className="text-gray-300 text-sm tracking-widest">Enter PIN</p>
                  : Array.from({ length: pin.length }).map((_, i) => (
                      <span key={i} className="w-3 h-3 rounded-full bg-blue-600 block" />
                    ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {NUMPAD_KEYS.map(key => (
                  <button key={key} onClick={() => handleNumpad(key)}
                    className={`py-3 rounded-xl text-xl font-semibold transition-all active:scale-95 select-none
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
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">Hi, {empStatus.employee.firstName}!</h2>
                {!empStatus.missedSignOut && (
                  <p className="text-sm text-gray-500 mt-1">
                    {empStatus.clockedIn
                      ? empStatus.onBreak ? 'You are on a break.' : 'You are signed in.'
                      : 'You are not signed in.'}
                  </p>
                )}
              </div>

              {/* Missed sign-out warning */}
              {empStatus.missedSignOut && (
                <div className="space-y-3">
                  <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-3 text-center">
                    <p className="text-orange-700 font-bold text-sm">You forgot to sign out!</p>
                    <p className="text-orange-600 text-xs mt-1">
                      Your last shift on <span className="font-semibold">{new Date(empStatus.missedSignOut + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}</span> was not closed.
                    </p>
                    <p className="text-orange-500 text-xs mt-1">Please sign out and enter your hours first.</p>
                  </div>
                  <button onClick={() => handleAction('clockOut')}
                    className="w-full py-4 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-colors">
                    Sign Out & Enter Hours
                  </button>
                  <button onClick={resetToIdle}
                    className="w-full py-2 text-gray-400 text-sm hover:text-gray-600 transition-colors">
                    Cancel
                  </button>
                </div>
              )}

              {/* Normal buttons */}
              {!empStatus.missedSignOut && (
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
              )}
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

          {/* CLOCK OUT SUMMARY */}
          {state === 'clockOutSummary' && clockOutInfo && (
            <div className="text-center py-4">
              <div className="text-4xl mb-2">👋</div>
              <p className="text-xl font-bold text-gray-800">Goodbye, {empStatus?.employee.firstName}!</p>
              <div className="mt-4 bg-gray-50 rounded-xl p-4 text-left space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Signed in</span>
                  <span className="font-semibold text-gray-800">{fmtTime(clockOutInfo.clockInTime)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Signed out</span>
                  <span className="font-semibold text-gray-800">{fmtTime(clockOutInfo.clockOutTime)}</span>
                </div>
                {clockOutInfo.breakMinutes > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Break</span>
                    <span className="font-semibold text-gray-800">{clockOutInfo.breakMinutes} min</span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-2 flex justify-between">
                  <span className="text-gray-700 font-medium">Total worked</span>
                  <span className="text-lg font-bold text-green-600">{shiftHours} hrs</span>
                </div>
              </div>
              <button onClick={() => setState('logTask')}
                className="mt-4 w-full py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-sm">
                Log Tasks →
              </button>
              <p className="text-xs text-gray-400 mt-2">Continuing in 6 seconds…</p>
            </div>
          )}

          {/* LOG TASK — simplified: hours only */}
          {state === 'logTask' && (
            <>
              <div className="text-center mb-4">
                <p className="text-sm font-medium text-gray-500">Confirm hours worked</p>
              </div>

              {taskError && (
                <p className="text-red-500 text-xs mb-3 text-center">{taskError}</p>
              )}

              <div className="bg-gray-50 rounded-xl p-4 text-center mb-4">
                <p className="text-xs text-gray-500 mb-1">Hours this shift</p>
                <input
                  type="number" step="0.25" min="0" max="24"
                  className="w-32 text-center text-3xl font-bold text-green-600 bg-transparent border-b-2 border-green-400 focus:outline-none focus:border-green-600"
                  value={taskForm.hoursWorked}
                  onChange={e => setTaskForm(f => ({ ...f, hoursWorked: e.target.value }))}
                />
                <p className="text-xs text-gray-400 mt-1">hrs</p>
              </div>

              <div className="flex gap-2">
                <button onClick={handleTaskSubmit}
                  className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors">
                  Submit
                </button>
                <button onClick={resetToIdle}
                  className="flex-1 py-3 border-2 border-gray-200 text-gray-400 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm">
                  Skip
                </button>
              </div>
            </>
          )}

          {/* TASK DONE */}
          {state === 'taskDone' && (
            <div className="text-center py-6">
              <div className="text-4xl mb-2">✓</div>
              <p className="font-semibold text-green-700">Hours submitted!</p>
              <p className="text-xs text-gray-400 mt-3">Camera ready for next person…</p>
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

      <p className="mt-2 text-orange-200 text-xs">
        <a href="/login" className="underline">Admin / Manager Login</a>
      </p>
    </div>
  );
}
