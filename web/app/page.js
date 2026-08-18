'use client';

import { useEffect, useState } from 'react';

async function fetchJSON(url, opts) {
  const r = await fetch(url, opts);
  return r.json();
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
        { label: 'DB Status', value: health.status || 'error', cls: health.status === 'ready' ? 'ok' : 'bad' },
        { label: 'Total Records', value: (health.total_records || 0).toLocaleString('id-ID') },
        { label: 'API Status', value: apiHealth.status || 'down', cls: apiHealth.ok ? 'ok' : 'bad' },
        { label: 'Duplicate Emails', value: metrics.duplicates ?? '-' },
        { label: 'Missing Fields', value: metrics.missing_fields ?? '-' },
        { label: 'Quality Score', value: (metrics.quality_score ?? '-') + (metrics.quality_score != null ? '%' : '') },
      ]);
    }
    loadStatus();
  }, []);

  return (
    <div className="grid">
      {cards.map((c) => (
        <div className="card" key={c.label}>
          <div className="label">{c.label}</div>
          <div className={`value ${c.cls || ''}`}>{c.value}</div>
        </div>
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
    <div className="nav-grid">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`nav-card${active === item.key ? ' selected' : ''}`}
          onClick={() => onSelect(item.key)}
          aria-pressed={active === item.key}
        >
          <div className="nav-card-label">{item.label}</div>
          <div className="nav-card-desc">{item.desc}</div>
        </button>
      ))}
    </div>
  );
}

function SearchSection() {
  const [q, setQ] = useState('a');
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
    <section>
      <h2>All Users</h2>
      <div className="row">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kata kunci..." disabled={loading} />
        <select value={type} onChange={(e) => setType(e.target.value)} disabled={loading}>
          <option value="name">Nama</option>
          <option value="email">Email</option>
          <option value="phone">Telepon</option>
          <option value="location">Lokasi</option>
        </select>
        <input
          type="number"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          style={{ width: 70 }}
          placeholder="Limit"
          disabled={loading}
        />
        <button onClick={() => runSearch(0)} disabled={loading}>
          {loading ? <><span className="spinner" /> Mencari...</> : 'Cari'}
        </button>
        {loading ? <span className="sub loading">Memuat hasil, mohon tunggu...</span> : <span className="sub">{meta}</span>}
      </div>
      <table>
        <thead>
          <tr>
            <th>ID</th><th>Nama</th><th>Email</th><th>Telepon</th><th>Order</th><th>Total Belanja</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={6}><span className="spinner" /> Memuat...</td></tr>
          ) : results.length === 0 ? (
            <tr><td colSpan={6}>Tidak ada hasil</td></tr>
          ) : (
            results.map((r) => (
              <tr key={r.user_id}>
                <td>{r.user_id}</td>
                <td>{r.full_name || r.user_name || '-'}</td>
                <td>{r.user_email || '-'}</td>
                <td>{r.msisdn || '-'}</td>
                <td>{r.order_count}</td>
                <td>{Number(r.total_spent).toLocaleString('id-ID')}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="row pagination">
        <button onClick={() => runSearch(offset - effectiveLimit)} disabled={loading || !hasPrev}>Previous</button>
        <span className="sub">Offset {offset} - {offset + results.length} dari {total}</span>
        <button onClick={() => runSearch(offset + effectiveLimit)} disabled={loading || !hasNext}>Next</button>
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
    <section>
      <h2>Duplicate Detection</h2>
      <div className="row">
        <select value={method} onChange={(e) => setMethod(e.target.value)} disabled={loading}>
          <option value="email">Email</option>
          <option value="phone">Telepon</option>
          <option value="ip_address">IP Address</option>
        </select>
        <button onClick={runDuplicates} disabled={loading}>
          {loading ? <><span className="spinner" /> Mencari...</> : 'Cari Duplikat'}
        </button>
        {loading ? <span className="sub loading">Memuat hasil, mohon tunggu...</span> : <span className="sub">{meta}</span>}
      </div>
      {!loading && error && <div className="profile-error">{error}</div>}
      <table>
        <thead>
          <tr><th>User ID 1</th><th>User ID 2</th><th>Similarity</th></tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={3}><span className="spinner" /> Memuat...</td></tr>
          ) : duplicates.length === 0 ? (
            <tr><td colSpan={3}>{error ? '-' : 'Tidak ada duplikat'}</td></tr>
          ) : (
            duplicates.map((d, i) => (
              <tr key={`${d.id1}-${d.id2}-${i}`}>
                <td>{d.id1}</td><td>{d.id2}</td><td>{d.similarity}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
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
    <section>
      <h2>User Profile Lookup</h2>
      <div className="row">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama user..." disabled={loading} />
        <button onClick={runSearch} disabled={loading}>
          {loading ? <><span className="spinner" /> Mencari...</> : 'Cari'}
        </button>
        {loading && <span className="sub loading">Memuat profil, mohon tunggu...</span>}
      </div>

      {!loading && error && <div className="profile-error">{error}</div>}

      {!loading && !error && candidates.length > 0 && (
        <div className="profile-candidates">
          <div className="sub">Ditemukan {candidates.length} kecocokan, pilih salah satu:</div>
          <table>
            <thead>
              <tr><th>Nama</th><th>Email</th><th>Telepon</th><th></th></tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.user_id}>
                  <td>{c.full_name || c.user_name || '-'}</td>
                  <td>{c.user_email || '-'}</td>
                  <td>{c.msisdn || '-'}</td>
                  <td><button onClick={() => selectCandidate(c.user_id)}>Lihat Profil</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && profile && (
        <div className="profile-card">
          <div className="profile-header">
            <div className="profile-name">{profile.full_name || profile.user_name || `User #${profile.user_id}`}</div>
            <div className="sub">
              ID {profile.user_id} &middot; {profile.user_email || 'Tanpa email'} &middot; {profile.msisdn || 'Tanpa telepon'}
            </div>
          </div>
          <div className="grid">
            <div className="card">
              <div className="label">Jumlah Order</div>
              <div className="value">{profile.order_count}</div>
            </div>
            <div className="card">
              <div className="label">Total Belanja</div>
              <div className="value">{Number(profile.total_spent).toLocaleString('id-ID')}</div>
            </div>
            <div className="card">
              <div className="label">Jumlah Transaksi</div>
              <div className="value">{profile.transaction_count}</div>
            </div>
            <div className="card">
              <div className="label">Total Nilai Transaksi</div>
              <div className="value">{Number(profile.total_transaction_amount).toLocaleString('id-ID')}</div>
            </div>
            <div className="card">
              <div className="label">Jumlah Aktivitas</div>
              <div className="value">{profile.activity_count}</div>
            </div>
          </div>
        </div>
      )}

      {!loading && !searched && <div className="sub">Masukkan nama user lalu klik &quot;Cari&quot;.</div>}
    </section>
  );
}

export default function Page() {
  const [active, setActive] = useState('users');

  return (
    <>
      <h1>Customer Intelligence Platform</h1>
      <div className="sub">15M+ customer records &middot; PostgreSQL &middot; Node.js/Express &middot; Next.js</div>
      <StatusCards />
      <NavCards active={active} onSelect={setActive} />
      {active === 'users' && <SearchSection />}
      {active === 'duplicates' && <DuplicatesSection />}
      {active === 'profile' && <ProfileSection />}
    </>
  );
}
