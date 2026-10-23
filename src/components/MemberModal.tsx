import React, { useState, useEffect } from 'react';
import { Member, DisciplineItem, PaymentStatus, PaymentMethod, MembershipStatus } from '../types';
import { calculateNextExpiration, formatDateISO } from '../lib/dateUtils';
import { processCarnetPhoto } from '../lib/imageUtils';
import { CameraCaptureModal } from './CameraCaptureModal';
import {
  X,
  User,
  Phone,
  Calendar,
  CreditCard,
  Dumbbell,
  Key,
  Camera,
  Upload,
  Trash2,
  Check,
  Lock,
} from 'lucide-react';

interface MemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  member?: Member | null;
  disciplines: DisciplineItem[];
}

const PAYMENT_METHODS: PaymentMethod[] = [
  'Efectivo',
  'Transferencia',
  'Tarjeta de débito',
  'Tarjeta de crédito',
  'Pago con QR',
];

export const MemberModal: React.FC<MemberModalProps> = ({
  isOpen,
  onClose,
  onSave,
  member,
  disciplines,
}) => {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [dni, setDni] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [telefono, setTelefono] = useState('');
  const [disciplina, setDisciplina] = useState('');
  const [fechaIngreso, setFechaIngreso] = useState(formatDateISO(new Date()));
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [montoMensual, setMontoMensual] = useState<number>(28000);
  const [estadoPago, setEstadoPago] = useState<PaymentStatus>('pagado');
  const [saldoPendiente, setSaldoPendiente] = useState<number>(0);
  const [metodoPago, setMetodoPago] = useState<PaymentMethod>('Efectivo');
  const [fotoUrl, setFotoUrl] = useState('');
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  useEffect(() => {
    if (member) {
      setNombre(member.nombre);
      setApellido(member.apellido);
      setDni(member.dni);
      setFechaNacimiento(member.fecha_nacimiento || '');
      setTelefono(member.telefono);
      setDisciplina(member.disciplina);
      setFechaIngreso(member.fecha_ingreso);
      setFechaVencimiento(member.fecha_vencimiento);
      setMontoMensual(member.monto_mensual || 28000);
      setEstadoPago(member.estado_pago === 'pendiente' ? 'saldo' : member.estado_pago);
      setSaldoPendiente(member.saldo_pendiente || 0);
      setMetodoPago(member.metodo_pago || 'Efectivo');
      setFotoUrl(member.foto_url || '');
      setNotas(member.notas || '');
    } else {
      const today = formatDateISO(new Date());
      const defaultDisc = disciplines[0] || { nombre: 'Musculación', precio: 28000 };
      setNombre('');
      setApellido('');
      setDni('');
      setFechaNacimiento('');
      setTelefono('+54 9 11 ');
      setDisciplina(defaultDisc.nombre);
      setFechaIngreso(today);
      setFechaVencimiento(calculateNextExpiration(today));
      setMontoMensual(defaultDisc.precio);
      setEstadoPago('pagado');
      setSaldoPendiente(0);
      setMetodoPago('Efectivo');
      setFotoUrl('');
      setNotas('');
    }
  }, [member, isOpen, disciplines]);

  const handleIngresoChange = (val: string) => {
    setFechaIngreso(val);
    setFechaVencimiento(calculateNextExpiration(val));
  };

  const handleDisciplineChange = (selectedName: string) => {
    setDisciplina(selectedName);
    const found = disciplines.find((d) => d.nombre === selectedName);
    if (found) {
      setMontoMensual(found.precio);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingPhoto(true);
    try {
      const compressed = await processCarnetPhoto(file, { size: 400, quality: 0.82 });
      setFotoUrl(compressed);
    } catch (err: any) {
      console.error('Error al procesar foto carnet:', err);
      alert('Error al procesar la imagen: ' + (err.message || 'formato incompatible'));
    } finally {
      setIsProcessingPhoto(false);
      e.target.value = '';
    }
  };

  const handleCameraCapture = (capturedDataUrl: string) => {
    setFotoUrl(capturedDataUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !apellido.trim() || !dni.trim()) {
      alert('Por favor completa Nombre, Apellido y DNI');
      return;
    }

    setLoading(true);
    try {
      const calculatedVencimiento = fechaVencimiento || calculateNextExpiration(fechaIngreso);
      const isConSaldo = estadoPago === 'saldo' || estadoPago === 'pendiente';
      const estadoMembresia: MembershipStatus = isConSaldo ? 'vencido' : 'activo';

      await onSave({
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        dni: dni.trim(),
        fecha_nacimiento: fechaNacimiento.trim() || undefined,
        telefono: telefono.trim(),
        disciplina: disciplina || disciplines[0]?.nombre || 'Musculación',
        fecha_ingreso: fechaIngreso,
        fecha_vencimiento: calculatedVencimiento,
        estado_membresia: estadoMembresia,
        estado_pago: estadoPago,
        saldo_pendiente: (estadoPago === 'parcial' || estadoPago === 'saldo')
          ? Number(saldoPendiente > 0 ? saldoPendiente : (estadoPago === 'saldo' ? montoMensual : 0))
          : 0,
        metodo_pago: metodoPago,
        monto_mensual: Number(montoMensual),
        foto_url: fotoUrl.trim(),
        notas: notas.trim(),
      });
      onClose();
    } catch (err: any) {
      console.error(err);
      alert('Error al guardar socio: ' + (err.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-sm">
        <div className="min-h-full flex items-center justify-center p-2.5 sm:p-4">
          <div className="bg-[#0a0a0a] border border-neutral-800 rounded-2xl w-full max-w-xl my-auto overflow-hidden shadow-2xl relative flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh]">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-neutral-900 flex items-center justify-between shrink-0 bg-[#0a0a0a]">
              <div>
                <h3 className="text-base sm:text-lg font-black text-white uppercase font-mono tracking-wide">
                  {member ? 'Editar Socio' : 'Nuevo Socio'}
                </h3>
                <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
                  {member
                    ? 'Modifica los datos del socio registrado'
                    : 'Registra un nuevo miembro del gimnasio'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
                {/* Nombre y Apellido */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-neutral-300 uppercase font-mono mb-1 flex items-center gap-1.5">
                  <User className="w-3 h-3 text-neutral-400" />
                  Nombre <span className="text-white">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Marcos"
                  className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-300 uppercase font-mono mb-1 flex items-center gap-1.5">
                  <User className="w-3 h-3 text-neutral-400" />
                  Apellido <span className="text-white">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                  placeholder="Ej: Maidana"
                  className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-white font-mono"
                />
              </div>
            </div>

            {/* DNI, Fecha de Nacimiento y Teléfono */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-neutral-300 uppercase font-mono mb-1 flex items-center gap-1.5">
                  <Key className="w-3 h-3 text-neutral-400" />
                  DNI (Clave) <span className="text-white">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  placeholder="40123456"
                  className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-300 uppercase font-mono mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-neutral-400" />
                  Fecha de Nacimiento
                </label>
                <input
                  type="date"
                  value={fechaNacimiento}
                  onChange={(e) => setFechaNacimiento(e.target.value)}
                  className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-300 uppercase font-mono mb-1 flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-neutral-400" />
                  WhatsApp / Teléfono
                </label>
                <input
                  type="text"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="+54 9 11 1234 5678"
                  className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-white font-mono"
                />
              </div>
            </div>

            {/* Disciplina y Cuota Mensual */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-neutral-300 uppercase font-mono mb-1 flex items-center gap-1.5">
                  <Dumbbell className="w-3 h-3 text-neutral-400" />
                  Disciplina
                </label>
                <select
                  value={disciplina}
                  onChange={(e) => handleDisciplineChange(e.target.value)}
                  className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white font-mono"
                >
                  {disciplines.map((d) => (
                    <option key={d.id} value={d.nombre}>
                      {d.nombre} (${d.precio.toLocaleString('es-AR')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-300 uppercase font-mono mb-1 flex items-center gap-1.5">
                  <CreditCard className="w-3 h-3 text-neutral-400" />
                  Monto Mensual ($ ARS)
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={montoMensual}
                  onChange={(e) => setMontoMensual(Number(e.target.value))}
                  className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white font-mono"
                />
              </div>
            </div>

            {/* Fechas de Ingreso y Vencimiento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-neutral-300 uppercase font-mono mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-neutral-400" />
                  Fecha de Ingreso
                </label>
                <input
                  type="date"
                  value={fechaIngreso}
                  onChange={(e) => handleIngresoChange(e.target.value)}
                  className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-300 uppercase font-mono mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-neutral-400" />
                  Vencimiento (1 Mes)
                </label>
                <input
                  type="date"
                  value={fechaVencimiento}
                  onChange={(e) => setFechaVencimiento(e.target.value)}
                  className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white font-mono"
                />
              </div>
            </div>

            {/* Estado de Pago y Método */}
            <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-900 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase font-mono mb-1.5">
                    Estado de Pago Inicial
                  </label>
                  <div className="flex items-center gap-1.5">
                    <label
                      className={`flex-1 py-1.5 px-2 rounded-lg border text-center cursor-pointer transition-all flex items-center justify-center gap-1 ${estadoPago === 'pagado'
                          ? 'bg-white text-black font-black border-white'
                          : 'bg-black text-neutral-400 border-neutral-800 hover:border-neutral-700'
                        }`}
                    >
                      <input
                        type="radio"
                        name="estadoPago"
                        checked={estadoPago === 'pagado'}
                        onChange={() => setEstadoPago('pagado')}
                        className="hidden"
                      />
                      <Check className="w-3 h-3" />
                      <span className="text-[10px] font-mono uppercase">Pagado</span>
                    </label>

                    <label
                      className={`flex-1 py-1.5 px-2 rounded-lg border text-center cursor-pointer transition-all flex items-center justify-center gap-1 ${estadoPago === 'parcial'
                          ? 'bg-amber-400 text-black font-black border-amber-300'
                          : 'bg-black text-neutral-400 border-neutral-800 hover:border-neutral-700'
                        }`}
                    >
                      <input
                        type="radio"
                        name="estadoPago"
                        checked={estadoPago === 'parcial'}
                        onChange={() => setEstadoPago('parcial')}
                        className="hidden"
                      />
                      <span className="text-[10px] font-mono uppercase">Parcial</span>
                    </label>

                    <label
                      className={`flex-1 py-1.5 px-2 rounded-lg border text-center cursor-pointer transition-all flex items-center justify-center gap-1 ${estadoPago === 'saldo' || estadoPago === 'pendiente'
                          ? 'bg-neutral-800 text-white font-bold border-neutral-600'
                          : 'bg-black text-neutral-400 border-neutral-800 hover:border-neutral-700'
                        }`}
                    >
                      <input
                        type="radio"
                        name="estadoPago"
                        checked={estadoPago === 'saldo' || estadoPago === 'pendiente'}
                        onChange={() => {
                          setEstadoPago('saldo');
                          if (!saldoPendiente) setSaldoPendiente(montoMensual);
                        }}
                        className="hidden"
                      />
                      <span className="text-[10px] font-mono uppercase">Saldo</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase font-mono mb-1.5">
                    Método de Pago
                  </label>
                  <select
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value as PaymentMethod)}
                    disabled={estadoPago === 'saldo' || estadoPago === 'pendiente'}
                    className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-white font-mono disabled:opacity-40"
                  >
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Si es Pago Parcial o Saldo, input para Saldo Pendiente */}
              {(estadoPago === 'parcial' || estadoPago === 'saldo') && (
                <div className="pt-2 border-t border-neutral-850 flex items-center justify-between gap-3">
                  <span className="text-xs text-amber-300 font-bold">
                    {estadoPago === 'saldo' ? 'Saldo adeudado ($):' : 'Saldo pendiente adeudado ($):'}
                  </span>
                  <div className="w-36">
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={saldoPendiente}
                      onChange={(e) => setSaldoPendiente(Number(e.target.value) || 0)}
                      className="w-full bg-black border border-amber-600/50 rounded-lg px-2.5 py-1 text-xs text-white font-mono text-right focus:outline-none focus:border-amber-400"
                      placeholder={String(montoMensual)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Foto de Perfil Carnet 1:1 */}
            <div className="bg-[#0e0e0e] border border-neutral-800/80 rounded-xl p-3 sm:p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-neutral-300 uppercase font-mono flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-neutral-400" />
                  Foto Carnet (1:1)
                </label>
                <span className="text-[10px] text-neutral-500 font-mono">
                  {fotoUrl ? 'Lista para carnet' : 'Opcional (se puede subir después)'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Preview 1:1 Box */}
                <div className="relative w-20 h-20 rounded-xl border border-neutral-700 bg-neutral-950 overflow-hidden shrink-0 flex items-center justify-center shadow-inner">
                  {fotoUrl ? (
                    <>
                      <img
                        src={fotoUrl}
                        alt="Foto carnet socio"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-0 inset-x-0 bg-black/70 backdrop-blur-[2px] text-center py-0.5 text-[8px] font-mono text-white/90">
                        1:1 Carnet
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-neutral-500 p-1 text-center">
                      <User className="w-6 h-6 stroke-[1.5] text-neutral-600 mb-0.5" />
                      <span className="text-[8px] font-mono uppercase tracking-tight text-neutral-500 leading-none">
                        Sin foto
                      </span>
                    </div>
                  )}

                  {isProcessingPhoto && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-white text-[10px] font-mono">
                      Procesando...
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Botón tomar foto con cámara */}
                    <button
                      type="button"
                      onClick={() => setIsCameraOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-neutral-200 active:scale-95 text-black font-black uppercase text-[11px] tracking-wide font-mono flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <Camera className="w-3.5 h-3.5 stroke-[2.5]" />
                      Sacar foto con cámara
                    </button>

                    {/* Botón subir archivo */}
                    <label className="cursor-pointer bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white text-[11px] px-3 py-1.5 rounded-lg border border-neutral-800 inline-flex items-center gap-1.5 font-mono transition-colors">
                      <Upload className="w-3.5 h-3.5 text-neutral-400" />
                      Subir archivo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        disabled={isProcessingPhoto}
                        className="hidden"
                      />
                    </label>

                    {/* Botón quitar foto */}
                    {fotoUrl && (
                      <button
                        type="button"
                        onClick={() => setFotoUrl('')}
                        title="Quitar foto"
                        className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-red-950/40 text-neutral-400 hover:text-red-400 border border-neutral-800 hover:border-red-900/50 text-[11px] font-mono flex items-center gap-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Quitar
                      </button>
                    )}
                  </div>

                  <p className="text-[10px] text-neutral-500 font-mono leading-relaxed">
                    Formato cuadrado 1:1 tipo carnet optimizado (&lt;40KB). Si no tomas ni subes ninguna foto, se guardará vacía para que puedas subirla después.
                  </p>
                </div>
              </div>
            </div>

            {/* Notas */}
            <div>
              <label className="block text-[11px] font-bold text-neutral-300 uppercase font-mono mb-1">
                Notas u Observaciones
              </label>
              <textarea
                rows={2}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Objetivos, apto médico, lesiones previas..."
                className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-white font-mono"
              />
            </div>

              </div>

              {/* Botones de acción */}
              <div className="p-3.5 sm:p-4 border-t border-neutral-900 bg-[#0a0a0a] flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-900 text-xs font-mono transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-lg bg-white hover:bg-neutral-200 active:scale-95 text-black font-black uppercase text-xs tracking-wider transition-all shadow-sm"
                >
                  {loading ? 'Guardando...' : member ? 'Actualizar Socio' : 'Guardar Socio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Modal de Cámara para Captura 1:1 */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
      />
    </>
  );
};
