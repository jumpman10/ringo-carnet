import React, { useState, useEffect } from 'react';
import { Member, AccessLog, PaymentLog, DisciplineItem, RenewMemberOptions } from './types';
import {
  fetchMembers,
  createMember,
  updateMember,
  deleteMember,
  renewMemberMembership,
  logAccess,
  getAccessLogs,
  fetchAccessLogs,
  fetchPaymentLogs,
  fetchDisciplines,
} from './lib/storage';
import { Navbar } from './components/Navbar';
import { AdminDashboard } from './components/AdminDashboard';
import { MemberModal } from './components/MemberModal';
import { QrScannerModal } from './components/QrScannerModal';
import { ExpiringListModal } from './components/ExpiringListModal';
import { VirtualCardModal } from './components/VirtualCardModal';
import { DisciplineConfigModal } from './components/DisciplineConfigModal';
import { NetworkModal } from './components/NetworkModal';

export default function App() {
  const [members, setMembers] = useState<Member[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [paymentLogs, setPaymentLogs] = useState<PaymentLog[]>([]);
  const [disciplines, setDisciplines] = useState<DisciplineItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isExpiringModalOpen, setIsExpiringModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
  const [selectedCardMember, setSelectedCardMember] = useState<Member | null>(null);

  // Normalize path if accessed via /admin or legacy route
  useEffect(() => {
    if (window.location.pathname !== '/') {
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // Load initial data
  const loadData = async () => {
    try {
      const [mems, accs, pays, discs] = await Promise.all([
        fetchMembers(),
        fetchAccessLogs(),
        fetchPaymentLogs(),
        fetchDisciplines(),
      ]);
      setMembers(mems);
      setAccessLogs(accs);
      setPaymentLogs(pays);
      setDisciplines(discs);
    } catch (err) {
      console.error('Error loading data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handlers
  const handleSaveMember = async (data: any) => {
    if (editingMember) {
      await updateMember(editingMember.id, data);
    } else {
      await createMember(data);
    }
    await loadData();
    setIsMemberModalOpen(false);
    setEditingMember(null);
  };

  const handleDeleteMember = async (id: string) => {
    await deleteMember(id);
    await loadData();
  };

  const handleRenewMember = async (id: string, options?: RenewMemberOptions) => {
    await renewMemberMembership(id, options);
    await loadData();
  };

  const handleLogAccess = async (logData: Omit<AccessLog, 'id' | 'timestamp'>) => {
    await logAccess(logData);
    setAccessLogs(getAccessLogs());
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col selection:bg-white selection:text-black antialiased">
      {/* Top Navbar */}
      <Navbar
        onOpenConfigModal={() => setIsConfigModalOpen(true)}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenNetworkModal={() => setIsNetworkModalOpen(true)}
      />

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-3 sm:py-6">
        {loading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center font-black text-xl mx-auto">
                R
              </div>
              <p className="text-xs font-mono uppercase tracking-wider text-neutral-400">Cargando Ringo Carnet...</p>
            </div>
          </div>
        ) : (
          <AdminDashboard
            members={members}
            accessLogs={accessLogs}
            paymentLogs={paymentLogs}
            disciplines={disciplines}
            onOpenNewMember={() => {
              setEditingMember(null);
              setIsMemberModalOpen(true);
            }}
            onOpenEditMember={(m) => {
              setEditingMember(m);
              setIsMemberModalOpen(true);
            }}
            onDeleteMember={handleDeleteMember}
            onRenewMember={handleRenewMember}
            onOpenScanner={() => setIsScannerOpen(true)}
            onOpenExpiringModal={() => setIsExpiringModalOpen(true)}
            onOpenCardModal={(m) => setSelectedCardMember(m)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-900 bg-black py-4 text-center text-xs text-neutral-500 no-print">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-1.5 font-mono text-[11px]">
          <span>&copy; {new Date().getFullYear()} Ringo Carnet • Sistema de Gestión y Carnets QR</span>
        </div>
      </footer>

      {/* Modals */}
      {/* 1. Member Add / Edit Modal */}
      <MemberModal
        isOpen={isMemberModalOpen}
        onClose={() => {
          setIsMemberModalOpen(false);
          setEditingMember(null);
        }}
        onSave={handleSaveMember}
        member={editingMember}
        disciplines={disciplines}
      />

      {/* 2. QR Scanner Modal */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        members={members}
        onLogAccess={handleLogAccess}
        onRenewMember={handleRenewMember}
      />

      {/* 3. Expiring List (≤ 2 days) & Bulk WhatsApp Modal */}
      <ExpiringListModal
        isOpen={isExpiringModalOpen}
        onClose={() => setIsExpiringModalOpen(false)}
        members={members}
      />

      {/* 4. Single Virtual Card Modal (View / Print) */}
      <VirtualCardModal
        isOpen={Boolean(selectedCardMember)}
        onClose={() => setSelectedCardMember(null)}
        member={selectedCardMember}
      />

      {/* 5. Discipline & Prices Configuration Modal */}
      <DisciplineConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        disciplines={disciplines}
        onDisciplinesChange={async () => {
          const updated = await fetchDisciplines();
          setDisciplines(updated);
        }}
      />

      {/* 6. Network & Backup Modal */}
      <NetworkModal
        isOpen={isNetworkModalOpen}
        onClose={() => setIsNetworkModalOpen(false)}
      />
    </div>
  );
}
