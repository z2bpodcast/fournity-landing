'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

const ADMIN_EMAILS = ['blessedmokoro@gmail.com'];

export default function AdminPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [busyEmail, setBusyEmail] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const { data } = await supabase.auth.getUser();
    const email = data?.user?.email?.toLowerCase();
    if (email && ADMIN_EMAILS.includes(email)) {
      setIsAdmin(true);
      loadMembers();
    }
    setAuthChecked(true);
  }

  async function submitAdminLogin(e) {
    e.preventDefault();
    setLoginErr('');
    setLoginBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });
    setLoginBusy(false);
    if (error) {
      setLoginErr('Incorrect email or password.');
      return;
    }
    const email = data?.user?.email?.toLowerCase();
    if (email && ADMIN_EMAILS.includes(email)) {
      setIsAdmin(true);
      loadMembers();
    } else {
      setLoginErr('This account is not authorized for admin access.');
    }
  }

  async function loadMembers() {
    setLoading(true);
    const [{ data: leads }, { data: orders }, { data: grants }] = await Promise.all([
      supabase.from('fournity_leads').select('*').order('created_at', { ascending: false }),
      supabase.from('fournity_orders').select('buyer_email, payment_status, payment_method, created_at'),
      supabase.from('fournity_access_grants').select('*'),
    ]);

    const orderMap = {};
    (orders || []).forEach((o) => {
      const email = o.buyer_email?.toLowerCase();
      if (!email) return;
      // Keep the most recent / most favorable status per email
      if (!orderMap[email] || o.payment_status === 'paid') orderMap[email] = o;
    });

    const grantMap = {};
    (grants || []).forEach((g) => {
      grantMap[g.email.toLowerCase()] = g;
    });

    const merged = (leads || []).map((lead) => {
      const email = lead.email?.toLowerCase();
      const order = orderMap[email];
      const grant = grantMap[email];
      const isAuthor = ADMIN_EMAILS.includes(email);
      let accessStatus = 'Locked';
      if (isAuthor) accessStatus = 'Author';
      else if (order?.payment_status === 'paid') accessStatus = 'Paid';
      else if (grant) accessStatus = 'Granted';
      else if (order?.payment_status === 'verifying') accessStatus = 'Verifying EFT';

      return {
        ...lead,
        orderStatus: order?.payment_status || null,
        paymentMethod: order?.payment_method || null,
        hasGrant: !!grant,
        grantReason: grant?.reason || '',
        accessStatus,
      };
    });

    setMembers(merged);
    setLoading(false);
  }

  async function toggleGrant(email, currentlyGranted) {
    setBusyEmail(email);
    if (currentlyGranted) {
      await supabase.from('fournity_access_grants').delete().eq('email', email);
    } else {
      const reason = window.prompt('Reason for granting free access (e.g. "Direct cash payment", "Gift"):', 'Gift — blessed with free access');
      if (reason === null) {
        setBusyEmail('');
        return;
      }
      await supabase.from('fournity_access_grants').upsert({
        email,
        reason: reason || 'Manual grant',
        granted_by: 'admin',
      });
    }
    await loadMembers();
    setBusyEmail('');
  }

  const filtered = members.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.full_name?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.whatsapp?.toLowerCase().includes(q)
    );
  });

  const stats = {
    total: members.length,
    paid: members.filter((m) => m.accessStatus === 'Paid').length,
    granted: members.filter((m) => m.accessStatus === 'Granted').length,
    verifying: members.filter((m) => m.accessStatus === 'Verifying EFT').length,
  };

  const styles = {
    page: { minHeight: '100vh', background: '#0a0a0f', color: '#f5f0e8', fontFamily: "'Inter', sans-serif", padding: '32px 20px' },
    container: { maxWidth: 1100, margin: '0 auto' },
    heading: { fontFamily: "'Cinzel', serif", fontSize: 28, color: '#c9a84c', marginBottom: 8 },
    sub: { color: '#8a8a9a', fontSize: 14, marginBottom: 28 },
    statsRow: { display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' },
    statCard: { background: '#131320', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 6, padding: '16px 24px', minWidth: 140 },
    statNum: { fontSize: 26, fontWeight: 700, color: '#e8c97a', fontFamily: "'Cinzel', serif" },
    statLabel: { fontSize: 12, color: '#8a8a9a', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
    searchBox: { width: '100%', maxWidth: 400, padding: '10px 14px', background: '#131320', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 4, color: '#f5f0e8', fontSize: 14, marginBottom: 20 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
    th: { textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid rgba(201,168,76,0.2)', color: '#c9a84c', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
    td: { padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', verticalAlign: 'top' },
    badge: (color) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: color + '22', color: color, border: `1px solid ${color}55` }),
    btn: { background: 'linear-gradient(135deg,#c9a84c,#8b6914)', color: '#0a0a0f', border: 'none', padding: '7px 14px', borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: 'pointer' },
    btnRevoke: { background: 'transparent', color: '#e74c3c', border: '1px solid #e74c3c55', padding: '7px 14px', borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: 'pointer' },
    waLink: { color: '#25d366', textDecoration: 'none', fontSize: 12 },
    loginCard: { maxWidth: 380, margin: '80px auto', background: '#131320', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, padding: 32 },
    field: { marginBottom: 14 },
    label: { display: 'block', fontSize: 11, color: '#c9a84c', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { width: '100%', padding: '10px 12px', background: 'rgba(245,240,232,0.04)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 4, color: '#f5f0e8', fontSize: 14 },
    err: { background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', color: '#e74c3c', fontSize: 12, padding: '10px 12px', borderRadius: 4, marginBottom: 14, textAlign: 'center' },
  };

  const statusColors = {
    Author: '#c9a84c',
    Paid: '#2ecc71',
    Granted: '#3498db',
    'Verifying EFT': '#f39c12',
    Locked: '#8a8a9a',
  };

  if (!authChecked) {
    return <div style={styles.page}><div style={styles.container}>Loading...</div></div>;
  }

  if (!isAdmin) {
    return (
      <div style={styles.page}>
        <div style={styles.loginCard}>
          <div style={{ ...styles.heading, textAlign: 'center' }}>FOURNITY Admin</div>
          <div style={{ ...styles.sub, textAlign: 'center' }}>Authorized access only.</div>
          {loginErr && <div style={styles.err}>{loginErr}</div>}
          <form onSubmit={submitAdminLogin}>
            <div style={styles.field}>
              <label style={styles.label}>Email</label>
              <input style={styles.input} type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <input style={styles.input} type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
            </div>
            <button style={{ ...styles.btn, width: '100%', padding: '12px 0' }} disabled={loginBusy}>
              {loginBusy ? 'Checking...' : 'Log In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.heading}>FOURNITY Command Center</div>
        <div style={styles.sub}>Members, payments, and access — all in one place.</div>

        <div style={styles.statsRow}>
          <div style={styles.statCard}><div style={styles.statNum}>{stats.total}</div><div style={styles.statLabel}>Total Registered</div></div>
          <div style={styles.statCard}><div style={{ ...styles.statNum, color: '#2ecc71' }}>{stats.paid}</div><div style={styles.statLabel}>Paid</div></div>
          <div style={styles.statCard}><div style={{ ...styles.statNum, color: '#3498db' }}>{stats.granted}</div><div style={styles.statLabel}>Granted Free</div></div>
          <div style={styles.statCard}><div style={{ ...styles.statNum, color: '#f39c12' }}>{stats.verifying}</div><div style={styles.statLabel}>Verifying EFT</div></div>
        </div>

        <input
          style={styles.searchBox}
          placeholder="Search by name, email, or WhatsApp..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading ? (
          <div>Loading members...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>WhatsApp</th>
                  <th style={styles.th}>Registered</th>
                  <th style={styles.th}>Access</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id}>
                    <td style={styles.td}>{m.full_name}</td>
                    <td style={styles.td}>{m.email}</td>
                    <td style={styles.td}>
                      {m.whatsapp ? (
                        <a
                          style={styles.waLink}
                          href={`https://wa.me/${m.whatsapp.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          💬 {m.whatsapp}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={styles.td}>{m.created_at ? new Date(m.created_at).toLocaleDateString() : '—'}</td>
                    <td style={styles.td}>
                      <span style={styles.badge(statusColors[m.accessStatus] || '#8a8a9a')}>{m.accessStatus}</span>
                    </td>
                    <td style={styles.td}>
                      {m.accessStatus === 'Author' || m.accessStatus === 'Paid' ? (
                        <span style={{ color: '#8a8a9a', fontSize: 12 }}>—</span>
                      ) : m.hasGrant ? (
                        <button
                          style={styles.btnRevoke}
                          disabled={busyEmail === m.email}
                          onClick={() => toggleGrant(m.email, true)}
                        >
                          {busyEmail === m.email ? '...' : 'Revoke'}
                        </button>
                      ) : (
                        <button
                          style={styles.btn}
                          disabled={busyEmail === m.email}
                          onClick={() => toggleGrant(m.email, false)}
                        >
                          {busyEmail === m.email ? '...' : 'Grant Access'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <div style={{ padding: 20, color: '#8a8a9a' }}>No members found.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
