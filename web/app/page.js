'use client';

import { useEffect, useState } from 'react';

async function fetchJSON(url, opts) {
  const r = await fetch(url, opts);
  return r.json();
}

function Spinner({ className = '' }) {
  return (
    <span
      className={`inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white align-middle ${className}`}
    />
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold text-slate-50">{value}</div>
    </div>
  );
}

function StatusCards() {
  const [cards, setCards] = useState([]);

  useEffect(() => {
    async function loadStatus() {
      const [health, apiHealth, metrics] = await Promise.all([
        fetchJSON('/health').catch(() => ({ status: 'error' })),
        fetchJSON('/api/health').catch(() => ({ ok: false })),
        fetchJSON('/api/metrics').catch(() => ({})),
      ]);
      setCards([
        { label: 'Total Records', value: (health.total_records || 0).toLocaleString('id-ID') },
        { label: 'Duplicate Emails', value: metrics.duplicates ?? '-' },
        { label: 'Missing Fields', value: metrics.missing_fields ?? '-' },
        { label: 'Quality Score', value: (metrics.quality_score ?? '-') + (metrics.quality_score != null ? '%' : '') },
      ]);
    }
    loadStatus();
  }, []);

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <StatCard key={c.label} label={c.label} value={c.value} />
      ))}
    </div>
  );
}

const NAV_ITEMS = [
  { key: 'users', label: 'All Users', desc: 'Cari dan telusuri seluruh data pelanggan' },
  { key: 'duplicates', label: 'Duplicate Detection', desc: 'Temukan email, telepon, atau IP yang duplikat' },
  { key: 'profile', label: 'User Profile Lookup', desc: 'Lihat detail profil satu pelanggan' },
];

function NavCards({ active, onSelect }) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {NAV_ITEMS.map((item) => {
        const selected = active === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            aria-pressed={selected}
            className={`rounded-xl border p-4 text-left transition-colors ${
              selected
                ? 'border-accent bg-accent-soft ring-1 ring-accent'
                : 'border-surface-border bg-surface-card hover:border-accent/60'
            }`}
          >
            <div className={`text-sm font-semibold ${selected ? 'text-accent-light' : 'text-slate-100'}`}>
              {item.label}
            </div>
            <div className="mt-1.5 text-xs leading-relaxed text-muted">{item.desc}</div>
          </button>
        );
      })}
    </div>
  );
}

function Breadcrumb({ active, onSelect }) {
  const current = NAV_ITEMS.find((item) => item.key === active);
  return (
    <nav className="mb-3 flex items-center gap-2 text-sm" aria-label="Breadcrumb">
      <button
        type="button"
        className="text-muted transition-colors hover:text-accent-light hover:underline"
        onClick={() => onSelect('users')}
      >
        Dashboard
      </button>
      <span className="text-slate-600">/</span>
      <span className="font-semibold text-slate-100">{current?.label}</span>
    </nav>
  );
}

const inputClass =
  'rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-60';
const buttonClass =
  'flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-border disabled:text-slate-500';
const sectionClass = 'mb-5 rounded-xl border border-surface-border bg-surface-card p-5';
const thClass = 'border-b border-surface-border px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted';
const tdClass = 'border-b border-surface-border px-3 py-2 text-slate-100';

function SearchSection() {
  const [q, setQ] = useState('');
  const [type, setType] = useState('name');
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [meta, setMeta] = useState('');
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  async function runSearch(nextOffset) {
    const effectiveOffset = nextOffset ?? 0;
    setLoading(true);
    try {
      const data = await fetchJSON(`/api/search?q=${encodeURIComponent(q)}&type=${type}&limit=${limit || 10}&offset=${effectiveOffset}`);
      setMeta(`${data.total ?? 0} hasil ditemukan · ${data.took_ms ?? '-'}ms`);
      setResults(data.results || []);
      setTotal(data.total ?? 0);
      setOffset(effectiveOffset);
    } finally {
      setLoading(false);
    }
  }

  const effectiveLimit = limit || 10;
  const hasPrev = offset > 0;
  const hasNext = offset + effectiveLimit < total;

  return (
    <section className={sectionClass}>
      <h2 className="mb-4 text-base font-semibold text-slate-50">All Users</h2>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputClass} min-w-[160px] flex-1`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Kata kunci..."
          disabled={loading}
        />
        <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)} disabled={loading}>
          <option value="name">Nama</option>
          <option value="email">Email</option>
          <option value="phone">Telepon</option>
          <option value="location">Lokasi</option>
        </select>
        <input
          type="number"
          className={`${inputClass} w-20`}
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          placeholder="Limit"
          disabled={loading}
        />
        <button className={buttonClass} onClick={() => runSearch(0)} disabled={loading}>
          {loading ? (
            <>
              <Spinner /> Mencari...
            </>
          ) : (
            'Cari'
          )}
        </button>
        {loading ? (
          <span className="text-xs text-amber-400">Memuat hasil, mohon tunggu...</span>
        ) : (
          <span className="text-xs text-muted">{meta}</span>
        )}
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={thClass}>ID</th>
              <th className={thClass}>Nama</th>
              <th className={thClass}>Email</th>
              <th className={thClass}>Telepon</th>
              <th className={thClass}>Order</th>
              <th className={thClass}>Total Belanja</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className={tdClass} colSpan={6}>
                  <Spinner className="border-muted/40 border-t-muted" /> Memuat...
                </td>
              </tr>
            ) : results.length === 0 ? (
              <tr>
                <td className={tdClass} colSpan={6}>
                  Tidak ada hasil
                </td>
              </tr>
            ) : (
              results.map((r) => (
                <tr key={r.user_id} className="hover:bg-surface/60">
                  <td className={tdClass}>{r.user_id}</td>
                  <td className={tdClass}>{r.full_name || r.user_name || '-'}</td>
                  <td className={tdClass}>{r.user_email || '-'}</td>
                  <td className={tdClass}>{r.msisdn || '-'}</td>
                  <td className={tdClass}>{r.order_count}</td>
                  <td className={tdClass}>{Number(r.total_spent).toLocaleString('id-ID')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button className={buttonClass} onClick={() => runSearch(offset - effectiveLimit)} disabled={loading || !hasPrev}>
          Previous
        </button>
        <span className="text-xs text-muted">
          Offset {offset} - {offset + results.length} dari {total}
        </span>
        <button className={buttonClass} onClick={() => runSearch(offset + effectiveLimit)} disabled={loading || !hasNext}>
          Next
        </button>
      </div>
    </section>
  );
}

function DuplicatesSection() {
  const [method, setMethod] = useState('email');
  const [meta, setMeta] = useState('');
  const [duplicates, setDuplicates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function runDuplicates() {
    setLoading(true);
    setError('');
    try {
      const data = await fetchJSON('/api/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method }),
      });
      if (data.error) {
        setError(data.error);
        setDuplicates([]);
      } else {
        setMeta(`${data.count ?? 0} pasangan ditemukan`);
        setDuplicates((data.duplicates || []).slice(0, 100));
      }
    } catch {
      setError('Gagal memuat data duplikat, coba lagi');
      setDuplicates([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={sectionClass}>
      <h2 className="mb-4 text-base font-semibold text-slate-50">Duplicate Detection</h2>
      <div className="flex flex-wrap items-center gap-2">
        <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value)} disabled={loading}>
          <option value="email">Email</option>
          <option value="phone">Telepon</option>
          <option value="ip_address">IP Address</option>
        </select>
        <button className={buttonClass} onClick={runDuplicates} disabled={loading}>
          {loading ? (
            <>
              <Spinner /> Mencari...
            </>
          ) : (
            'Cari Duplikat'
          )}
        </button>
        {loading ? (
          <span className="text-xs text-amber-400">Memuat hasil, mohon tunggu...</span>
        ) : (
          <span className="text-xs text-muted">{meta}</span>
        )}
      </div>
      {!loading && error && <div className="mt-2 text-sm text-red-400">{error}</div>}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={thClass}>User ID 1</th>
              <th className={thClass}>Nama 1</th>
              <th className={thClass}>User ID 2</th>
              <th className={thClass}>Nama 2</th>
              <th className={thClass}>Similarity</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className={tdClass} colSpan={5}>
                  <Spinner className="border-muted/40 border-t-muted" /> Memuat...
                </td>
              </tr>
            ) : duplicates.length === 0 ? (
              <tr>
                <td className={tdClass} colSpan={5}>
                  {error ? '-' : 'Tidak ada duplikat'}
                </td>
              </tr>
            ) : (
              duplicates.map((d, i) => (
                <tr key={`${d.id1}-${d.id2}-${i}`} className="hover:bg-surface/60">
                  <td className={tdClass}>{d.id1}</td>
                  <td className={tdClass}>{d.name1 || '-'}</td>
                  <td className={tdClass}>{d.id2}</td>
                  <td className={tdClass}>{d.name2 || '-'}</td>
                  <td className={tdClass}>{d.similarity}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProfileSection() {
  const [name, setName] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function loadProfile(userId) {
    const data = await fetchJSON(`/api/user-profile/${userId}`);
    if (data.error) {
      setError(data.error === 'user not found' ? 'User tidak ditemukan' : data.error);
    } else {
      setProfile(data);
    }
  }

  async function runSearch() {
    setLoading(true);
    setError('');
    setProfile(null);
    setCandidates([]);
    try {
      const data = await fetchJSON(`/api/search?q=${encodeURIComponent(name)}&type=name&limit=8&offset=0`);
      const results = data.results || [];
      if (results.length === 0) {
        setError('User tidak ditemukan');
      } else if (results.length === 1) {
        await loadProfile(results[0].user_id);
      } else {
        setCandidates(results);
      }
    } catch {
      setError('Gagal mencari user, coba lagi');
    } finally {
      setSearched(true);
      setLoading(false);
    }
  }

  async function selectCandidate(userId) {
    setLoading(true);
    setError('');
    setCandidates([]);
    try {
      await loadProfile(userId);
    } catch {
      setError('Gagal memuat profil, coba lagi');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={sectionClass}>
      <h2 className="mb-4 text-base font-semibold text-slate-50">User Profile Lookup</h2>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputClass} min-w-[200px] flex-1`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama user..."
          disabled={loading}
        />
        <button className={buttonClass} onClick={runSearch} disabled={loading}>
          {loading ? (
            <>
              <Spinner /> Mencari...
            </>
          ) : (
            'Cari'
          )}
        </button>
        {loading && <span className="text-xs text-amber-400">Memuat profil, mohon tunggu...</span>}
      </div>

      {!loading && error && <div className="mt-2 text-sm text-red-400">{error}</div>}

      {!loading && !error && candidates.length > 0 && (
        <div className="mt-3">
          <div className="mb-2 text-xs text-muted">Ditemukan {candidates.length} kecocokan, pilih salah satu:</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className={thClass}>Nama</th>
                  <th className={thClass}>Email</th>
                  <th className={thClass}>Telepon</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.user_id} className="hover:bg-surface/60">
                    <td className={tdClass}>{c.full_name || c.user_name || '-'}</td>
                    <td className={tdClass}>{c.user_email || '-'}</td>
                    <td className={tdClass}>{c.msisdn || '-'}</td>
                    <td className={tdClass}>
                      <button
                        className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-white hover:bg-accent-hover"
                        onClick={() => selectCandidate(c.user_id)}
                      >
                        Lihat Profil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && profile && (
        <div className="mt-4">
          <div className="mb-4">
            <div className="text-lg font-semibold text-slate-50">
              {profile.full_name || profile.user_name || `User #${profile.user_id}`}
            </div>
            <div className="mt-1 text-xs text-muted">
              ID {profile.user_id} &middot; {profile.user_email || 'Tanpa email'} &middot; {profile.msisdn || 'Tanpa telepon'}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Jumlah Order" value={profile.order_count} />
            <StatCard label="Total Belanja" value={Number(profile.total_spent).toLocaleString('id-ID')} />
            <StatCard label="Jumlah Transaksi" value={profile.transaction_count} />
            <StatCard label="Total Nilai Transaksi" value={Number(profile.total_transaction_amount).toLocaleString('id-ID')} />
            <StatCard label="Jumlah Aktivitas" value={profile.activity_count} />
          </div>
        </div>
      )}

      {!loading && !searched && <div className="mt-2 text-xs text-muted">Masukkan nama user lalu klik &quot;Cari&quot;.</div>}
    </section>
  );
}

export default function Page() {
  const [active, setActive] = useState('users');

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="mb-5 text-xl font-semibold text-slate-50">Customer Intelligence Platform</h1>
      <StatusCards />
      <NavCards active={active} onSelect={setActive} />
      <Breadcrumb active={active} onSelect={setActive} />
      {active === 'users' && <SearchSection />}
      {active === 'duplicates' && <DuplicatesSection />}
      {active === 'profile' && <ProfileSection />}
    </div>
  );
}
