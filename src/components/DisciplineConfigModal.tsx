import React, { useState } from 'react';
import { DisciplineItem } from '../types';
import { saveDiscipline, deleteDiscipline } from '../lib/storage';
import { X, Settings, Plus, Edit2, Trash2, Check, AlertCircle, RefreshCw, DollarSign } from 'lucide-react';

interface DisciplineConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  disciplines: DisciplineItem[];
  onDisciplinesChange: () => Promise<void>;
}

export const DisciplineConfigModal: React.FC<DisciplineConfigModalProps> = ({
  isOpen,
  onClose,
  disciplines,
  onDisciplinesChange,
}) => {
  const [newNombre, setNewNombre] = useState('');
  const [newPrecio, setNewPrecio] = useState<number | ''>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editPrecio, setEditPrecio] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmed = newNombre.trim();
    if (!trimmed) {
      setErrorMsg('Ingresa el nombre de la disciplina.');
      return;
    }

    if (newPrecio === '' || Number(newPrecio) <= 0) {
      setErrorMsg('Ingresa un precio válido mayor a 0.');
      return;
    }

    // Check duplicate
    if (disciplines.some((d) => d.nombre.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg('Ya existe una disciplina con ese nombre.');
      return;
    }

    setLoading(true);
    try {
      await saveDiscipline({
        nombre: trimmed,
        precio: Number(newPrecio),
      });
      setNewNombre('');
      setNewPrecio('');
      await onDisciplinesChange();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar la disciplina.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (item: DisciplineItem) => {
    setEditingId(item.id);
    setEditNombre(item.nombre);
    setEditPrecio(item.precio);
    setErrorMsg(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditNombre('');
    setEditPrecio('');
  };

  const handleSaveEdit = async (id: string) => {
    setErrorMsg(null);
    const trimmed = editNombre.trim();
    if (!trimmed) {
      setErrorMsg('El nombre no puede estar vacío.');
      return;
    }
    if (editPrecio === '' || Number(editPrecio) <= 0) {
      setErrorMsg('El precio debe ser mayor a 0.');
      return;
    }

    // Check duplicate name excluding self
    if (disciplines.some((d) => d.id !== id && d.nombre.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg('Ya existe otra disciplina con ese nombre.');
      return;
    }

    setLoading(true);
    try {
      await saveDiscipline({
        id,
        nombre: trimmed,
        precio: Number(editPrecio),
      });
      setEditingId(null);
      await onDisciplinesChange();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al actualizar disciplina.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, nombre: string) => {
    if (disciplines.length <= 1) {
      alert('Debe haber al menos una disciplina disponible.');
      return;
    }

    if (!confirm(`¿Estás seguro de eliminar la disciplina "${nombre}"?`)) {
      return;
    }

    setLoading(true);
    try {
      await deleteDiscipline(id);
      await onDisciplinesChange();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar disciplina.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/90 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#0a0a0a] border border-neutral-800 rounded-2xl w-full max-w-xl my-4 sm:my-8 overflow-hidden shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-neutral-800 bg-black">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                Configurar Disciplinas y Precios
              </h2>
              <p className="text-[11px] text-neutral-400 font-mono">
                Tarifas fijas de cuotas mensuales
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded hover:bg-neutral-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-700 text-white text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-white shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Add Form */}
          <form
            onSubmit={handleCreate}
            className="bg-neutral-950 p-3 sm:p-3.5 rounded-xl border border-neutral-800 space-y-3"
          >
            <span className="text-[10px] font-bold text-neutral-400 uppercase font-mono block">
              Agregar Nueva Disciplina
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-6">
                <input
                  type="text"
                  required
                  placeholder="Nombre (ej. Natación, Boxeo)"
                  value={newNombre}
                  onChange={(e) => setNewNombre(e.target.value)}
                  className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-white font-mono"
                />
              </div>
              <div className="sm:col-span-4">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 text-xs font-mono">
                    $
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="500"
                    required
                    placeholder="Precio Cuota"
                    value={newPrecio}
                    onChange={(e) => setNewPrecio(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-black border border-neutral-800 rounded-lg pl-6 pr-2.5 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-white font-mono"
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-full py-2 px-3 bg-white hover:bg-neutral-200 active:scale-95 text-black font-black text-xs uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Crear</span>
                </button>
              </div>
            </div>
          </form>

          {/* Disciplines List */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-neutral-400 uppercase font-mono block">
              Disciplinas Activas ({disciplines.length})
            </span>

            <div className="divide-y divide-neutral-900 border border-neutral-800 rounded-xl overflow-hidden bg-black">
              {disciplines.map((d) => {
                const isEditing = editingId === d.id;

                if (isEditing) {
                  return (
                    <div
                      key={d.id}
                      className="p-3 bg-neutral-950 flex flex-col sm:flex-row items-center gap-2"
                    >
                      <input
                        type="text"
                        value={editNombre}
                        onChange={(e) => setEditNombre(e.target.value)}
                        className="w-full sm:flex-1 bg-black border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-white"
                      />
                      <div className="relative w-full sm:w-36">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 text-xs font-mono">
                          $
                        </span>
                        <input
                          type="number"
                          min="1"
                          step="500"
                          value={editPrecio}
                          onChange={(e) =>
                            setEditPrecio(e.target.value === '' ? '' : Number(e.target.value))
                          }
                          className="w-full bg-black border border-neutral-700 rounded-lg pl-6 pr-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-white"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(d.id)}
                          className="p-1.5 bg-white text-black hover:bg-neutral-200 rounded-md transition-colors"
                          title="Guardar cambios"
                        >
                          <Check className="w-4 h-4 stroke-[2.5]" />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="p-1.5 bg-neutral-900 text-neutral-400 hover:text-white rounded-md border border-neutral-800 transition-colors"
                          title="Cancelar"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={d.id}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-neutral-950/60 transition-colors"
                  >
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-white tracking-wide uppercase font-mono truncate">
                        {d.nombre}
                      </h4>
                      <p className="text-[11px] font-mono text-neutral-400 mt-0.5">
                        Cuota oficial: <span className="text-white font-bold">${Number(d.precio).toLocaleString('es-AR')}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(d)}
                        className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg border border-transparent hover:border-neutral-800 transition-colors"
                        title="Editar disciplina y precio"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(d.id, d.nombre)}
                        className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-900 rounded-lg border border-transparent hover:border-neutral-800 transition-colors"
                        title="Eliminar disciplina"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-neutral-800 bg-black flex justify-between items-center text-[11px] font-mono text-neutral-500">
          <span>Los cambios aplicarán a los nuevos socios y cuotas calculadas.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg border border-neutral-800"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
