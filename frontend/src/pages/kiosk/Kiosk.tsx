import { useState, useEffect, useRef } from 'react';
import { kioskAction, getEmployeeStatus, kioskSubmitTimesheet } from '../../api';
import { useAuth } from '../../context/AuthContext';

type KioskState = 'idle' | 'identified' | 'success' | 'missedSignoutForm' | 'missedSignoutDone' | 'clockOutSummary' | 'logTask' | 'taskDone' | 'error';

interface EmployeeStatus {
  employee: { firstName: string; lastName: string };
  clockedIn: boolean;
  onBreak: boolean;
  missedSignOut: string | null;
}

const NUMPAD_KEYS = ['1','2','3','4','5','6','7','8','9','⌫','0','✓'];

function playTone(type: 'in' | 'out' | 'error') {
  try {
    const ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    if (type === 'in') {
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
    } else if (type === 'out') {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(550, ctx.currentTime + 0.12);
    } else {
      osc.frequency.setValueAtTime(220, ctx.currentTime);
    }
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {}
}

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
  const [missedHours, setMissedHours] = useState('');
  const [clockOutInfo, setClockOutInfo] = useState<{ clockInTime: string; clockOutTime: string; breakMinutes: number } | null>(null);
  const [taskForm, setTaskForm] = useState({ taskName: '', hoursWorked: '', description: '' });
  const [taskError, setTaskError] = useState('');
  const [loading, setLoading] = useState(false);

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
    if (state === 'taskDone' || state === 'missedSignoutDone' || state === 'error') {
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
    setMissedHours('');
    setTaskForm({ taskName: '', hoursWorked: '', description: '' });
    setTaskError('');
    setLoading(false);
  }

  async function handlePinSubmit(pinToUse: string) {
    if (!pinToUse || loading) return;
    setLoading(true);
    try {
      const s = await getEmployeeStatus(pinToUse);
      setEmpStatus(s);
      setState('identified');
    } catch {
      playTone('error');
      setMessage('PIN not recognised. Please try again.');
      setState('error');
    } finally {
      setLoading(false);
    }
  }

  function handleNumpad(key: string) {
    if (loading) return;
    if (key === '⌫') {
      setPin(p => p.slice(0, -1));
    } else if (key === '✓') {
      handlePinSubmit(pin);
    } else if (pin.length < 6) {
      const newPin = pin + key;
      setPin(newPin);
      if (newPin.length === 4) handlePinSubmit(newPin);
    }
  }

  async function handleAction(action: string) {
    const photo = snapPhoto();
    setCapturedPhoto(photo);
    try {
      const result = await kioskAction(pin, action, user?.branchId, photo);
      if (action === 'clockOut') {
        playTone('out');
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
        playTone('in');
        const labels: Record<string, string> = {
          clockIn:    `Welcome, ${empStatus?.employee.firstName}!\nYou are now signed in.`,
          breakStart: 'Break started.\nEnjoy your break!',
          breakEnd:   `Welcome back,\n${empStatus?.employee.firstName}!`,
        };
        setMessage(labels[action] ?? 'Done!');
        setState('success');
      }
    } catch (err: any) {
      playTone('error');
      setMessage(err.response?.data?.error ?? 'Something went wrong.');
      setState('error');
    }
  }

  async function handleTaskSubmit() {
    if (!taskForm.hoursWorked) { setTaskError('Please enter hours worked.'); return; }
    try {
      await kioskSubmitTimesheet({
        pin, taskName: 'Shift', hoursWorked: taskForm.hoursWorked,
        description: taskForm.description, date: new Date().toISOString().slice(0, 10),
      });
      playTone('out');
      setState('taskDone');
    } catch {
      setTaskError('Could not submit. Please try again.');
    }
  }

  const timeStr = clock.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = clock.toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const hideCamera = ['logTask','taskDone','clockOutSummary','missedSignoutForm','missedSignoutDone'].includes(state);

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  function fmtDate(dateStr: string) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-gray-900 via-gray-700 to-orange-600 flex flex-col items-center justify-center p-2">

      {/* Header: logo + clock */}
      <div className="flex items-center justify-center gap-5 text-white mb-2 w-full max-w-sm">
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
        <div className="text-center">
          <p className="text-4xl font-light tabular-nums">{timeStr}</p>
          <p className="text-sm text-orange-100">{dateStr}</p>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Camera */}
        {!hideCamera && (
          <div className="relative bg-gray-900 w-full overflow-hidden" style={{ height: '220px' }}>
            <video ref={videoRef} autoPlay playsInline muted
              className={`w-full h-full object-cover ${capturedPhoto ? 'hidden' : 'block'}`} />
            {capturedPhoto && <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover" />}
            {!cameraReady && !capturedPhoto && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">Camera not available</div>
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
            {/* Idle instruction overlay */}
            {state === 'idle' && (
              <div className="absolute bottom-2 left-0 right-0 text-center">
                <span className="bg-black bg-opacity-50 text-white text-xs px-3 py-1 rounded-full">
                  👆 Look into the camera
                </span>
              </div>
            )}
          </div>
        )}

        <div className="p-3">

          {/* IDLE — numpad */}
          {state === 'idle' && (
            <>
              {/* Instruction */}
              <div className="text-center mb-3">
                {pin.length === 0 ? (
                  <p className="text-gray-400 font-medium text-sm tracking-wide">Enter your 4-digit PIN below</p>
                ) : (
                  <div className="flex justify-center gap-4 items-center">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className={`w-4 h-4 rounded-full transition-all ${i < pin.length ? 'bg-orange-500 scale-110' : 'bg-gray-200'}`} />
                    ))}
                  </div>
                )}
              </div>

              {loading && (
                <p className="text-center text-orange-500 text-sm mb-2 font-medium">Checking PIN…</p>
              )}

              <div className="grid grid-cols-3 gap-2">
                {NUMPAD_KEYS.map(key => (
                  <button key={key} onClick={() => handleNumpad(key)}
                    className={`py-4 rounded-xl text-2xl font-bold transition-all active:scale-90 select-none shadow-sm
                      ${key === '✓' ? 'bg-orange-500 text-white hover:bg-orange-600'
                        : key === '⌫' ? 'bg-gray-100 text-gray-500 hover:bg-gray-200 text-xl'
                        : 'bg-gray-50 text-gray-800 hover:bg-gray-100 border border-gray-200'}`}>
                    {key}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* IDENTIFIED */}
          {state === 'identified' && empStatus && (
            <>
              {/* Name banner */}
              <div className={`text-center py-3 px-4 rounded-xl mb-3 ${empStatus.missedSignOut ? 'bg-orange-50' : empStatus.clockedIn ? 'bg-blue-50' : 'bg-green-50'}`}>
                <p className="text-2xl font-black text-gray-800">👋 Hi, {empStatus.employee.firstName}!</p>
                {!empStatus.missedSignOut && (
                  <p className={`text-sm font-medium mt-1 ${empStatus.clockedIn ? (empStatus.onBreak ? 'text-yellow-600' : 'text-blue-600') : 'text-green-600'}`}>
                    {empStatus.clockedIn ? (empStatus.onBreak ? '☕ You are on a break' : '✅ You are signed in') : '👇 You are not signed in'}
                  </p>
                )}
              </div>

              {/* Missed sign-out warning */}
              {empStatus.missedSignOut && (
                <div className="space-y-2">
                  <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-3 text-center">
                    <p className="text-orange-700 font-bold">⚠️ You forgot to sign out!</p>
                    <p className="text-orange-600 text-sm mt-1">
                      Last shift on <span className="font-bold">{fmtDate(empStatus.missedSignOut)}</span> was not closed.
                    </p>
                    <p className="text-orange-500 text-xs mt-1">Enter your hours first, then you can sign in today.</p>
                  </div>
                  <button onClick={() => setState('missedSignoutForm')}
                    className="w-full py-4 bg-orange-500 text-white text-lg font-bold rounded-xl hover:bg-orange-600 transition-colors">
                    Enter My Hours
                  </button>
                  <button onClick={resetToIdle} className="w-full py-2 text-gray-400 text-sm">Cancel</button>
                </div>
              )}

              {/* Normal action buttons */}
              {!empStatus.missedSignOut && (
                <div className="space-y-2">
                  {!empStatus.clockedIn && (
                    <button onClick={() => handleAction('clockIn')}
                      className="w-full py-5 bg-green-500 text-white text-xl font-black rounded-xl hover:bg-green-600 transition-colors shadow">
                      ✅ Sign In
                    </button>
                  )}
                  {empStatus.clockedIn && !empStatus.onBreak && (
                    <button onClick={() => handleAction('breakStart')}
                      className="w-full py-4 bg-yellow-400 text-white text-lg font-bold rounded-xl hover:bg-yellow-500 transition-colors shadow">
                      ☕ Start Break
                    </button>
                  )}
                  {empStatus.clockedIn && empStatus.onBreak && (
                    <button onClick={() => handleAction('breakEnd')}
                      className="w-full py-4 bg-yellow-400 text-white text-lg font-bold rounded-xl hover:bg-yellow-500 transition-colors shadow">
                      ✅ End Break
                    </button>
                  )}
                  {empStatus.clockedIn && (
                    <button onClick={() => handleAction('clockOut')}
                      className="w-full py-5 bg-red-500 text-white text-xl font-black rounded-xl hover:bg-red-600 transition-colors shadow">
                      🚪 Sign Out
                    </button>
                  )}
                  <button onClick={resetToIdle} className="w-full py-2 text-gray-400 text-sm">Cancel</button>
                </div>
              )}
            </>
          )}

          {/* SUCCESS */}
          {state === 'success' && (
            <div className="text-center py-6">
              <div className="text-6xl mb-3">✅</div>
              {message.split('\n').map((line, i) => (
                <p key={i} className={`font-black text-green-700 ${i === 0 ? 'text-2xl' : 'text-lg font-semibold text-green-600 mt-1'}`}>{line}</p>
              ))}
              <p className="text-xs text-gray-400 mt-4">Screen resets in 5 seconds…</p>
            </div>
          )}

          {/* MISSED SIGN-OUT FORM */}
          {state === 'missedSignoutForm' && empStatus && (
            <>
              <div className="text-center mb-3">
                <p className="font-bold text-orange-600">Missed shift — {empStatus.missedSignOut ? fmtDate(empStatus.missedSignOut) : ''}</p>
                <p className="text-sm text-gray-500 mt-1">How many hours did you work that day?</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-4 text-center mb-3">
                <p className="text-xs text-gray-500 mb-1">Hours worked</p>
                <input
                  type="number" step="0.5" min="0" max="24"
                  className="w-32 text-center text-4xl font-black text-orange-600 bg-transparent border-b-2 border-orange-400 focus:outline-none"
                  value={missedHours}
                  onChange={e => setMissedHours(e.target.value)}
                  placeholder="0"
                />
                <p className="text-sm text-gray-400 mt-1">hours</p>
              </div>
              {taskError && <p className="text-red-500 text-xs mb-2 text-center">{taskError}</p>}
              <div className="flex gap-2">
                <button onClick={async () => {
                  if (!missedHours) { setTaskError('Please enter hours.'); return; }
                  try {
                    await kioskAction(pin, 'fixMissedSignout', undefined, null, { hoursWorked: missedHours });
                    playTone('out');
                    setState('missedSignoutDone');
                  } catch { setTaskError('Could not save. Please try again.'); }
                }}
                  className="flex-1 py-4 bg-orange-500 text-white text-lg font-bold rounded-xl hover:bg-orange-600">
                  Save & Sign Out
                </button>
                <button onClick={resetToIdle}
                  className="flex-1 py-4 border-2 border-gray-200 text-gray-400 font-semibold rounded-xl text-sm">
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* MISSED SIGN-OUT DONE */}
          {state === 'missedSignoutDone' && (
            <div className="text-center py-6">
              <div className="text-5xl mb-2">✅</div>
              <p className="text-xl font-black text-green-700">Hours saved!</p>
              <p className="text-base text-gray-500 mt-2">You can now sign in for today.</p>
              <p className="text-xs text-gray-400 mt-3">Returning in 3 seconds…</p>
            </div>
          )}

          {/* CLOCK OUT SUMMARY */}
          {state === 'clockOutSummary' && clockOutInfo && (
            <div className="text-center py-3">
              <p className="text-2xl font-black text-gray-800">👋 Goodbye, {empStatus?.employee.firstName}!</p>
              <div className="mt-3 bg-gray-50 rounded-xl p-3 text-left space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Signed in</span>
                  <span className="font-bold text-gray-800">{fmtTime(clockOutInfo.clockInTime)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Signed out</span>
                  <span className="font-bold text-gray-800">{fmtTime(clockOutInfo.clockOutTime)}</span>
                </div>
                {clockOutInfo.breakMinutes > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Break</span>
                    <span className="font-bold text-gray-800">{clockOutInfo.breakMinutes} min</span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                  <span className="text-gray-700 font-bold">Total worked</span>
                  <span className="text-2xl font-black text-green-600">{shiftHours} hrs</span>
                </div>
              </div>
              <button onClick={() => setState('logTask')}
                className="mt-3 w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 text-sm">
                Confirm Hours →
              </button>
              <p className="text-xs text-gray-400 mt-1">Auto-continues in 6 seconds…</p>
            </div>
          )}

          {/* LOG TASK */}
          {state === 'logTask' && (
            <>
              <div className="text-center mb-3">
                <p className="font-bold text-gray-600">Confirm your hours</p>
              </div>
              {taskError && <p className="text-red-500 text-xs mb-2 text-center">{taskError}</p>}
              <div className="bg-gray-50 rounded-xl p-4 text-center mb-3">
                <p className="text-xs text-gray-500 mb-1">Hours this shift</p>
                <input
                  type="number" step="0.25" min="0" max="24"
                  className="w-32 text-center text-4xl font-black text-green-600 bg-transparent border-b-2 border-green-400 focus:outline-none"
                  value={taskForm.hoursWorked}
                  onChange={e => setTaskForm(f => ({ ...f, hoursWorked: e.target.value }))}
                />
                <p className="text-sm text-gray-400 mt-1">hours</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleTaskSubmit}
                  className="flex-1 py-4 bg-green-500 text-white text-lg font-bold rounded-xl hover:bg-green-600">
                  ✅ Submit
                </button>
                <button onClick={resetToIdle}
                  className="flex-1 py-4 border-2 border-gray-200 text-gray-400 font-semibold rounded-xl text-sm">
                  Skip
                </button>
              </div>
            </>
          )}

          {/* TASK DONE */}
          {state === 'taskDone' && (
            <div className="text-center py-6">
              <div className="text-5xl mb-2">✅</div>
              <p className="text-xl font-black text-green-700">All done!</p>
              <p className="text-sm text-gray-500 mt-1">Hours submitted successfully.</p>
              <p className="text-xs text-gray-400 mt-3">Ready for next person…</p>
            </div>
          )}

          {/* ERROR */}
          {state === 'error' && (
            <div className="text-center py-5">
              <div className="text-5xl mb-2">❌</div>
              <p className="text-lg font-bold text-red-600">{message}</p>
              <p className="text-xs text-gray-400 mt-3">Returning in 3 seconds…</p>
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
