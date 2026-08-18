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
      <h2>Search Users</h2>
      <div className="row">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kata kunci..." />
        <select value={type} onChange={(e) => setType(e.target.value)}>
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
        />
        <button onClick={() => runSearch(0)} disabled={loading}>Cari</button>
        {loading ? <span className="sub loading">Memuat...</span> : <span className="sub">{meta}</span>}
      </div>
      <table>
        <thead>
          <tr>
            <th>ID</th><th>Nama</th><th>Email</th><th>Telepon</th><th>Order</th><th>Total Belanja</th>
          </tr>
        </thead>
        <tbody>
          {results.length === 0 ? (
            <tr><td colSpan={6}>{loading ? 'Memuat...' : 'Tidak ada hasil'}</td></tr>
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

  async function runDuplicates() {
    const data = await fetchJSON('/api/duplicates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method }),
    });
    setMeta(`${data.count ?? 0} pasangan ditemukan`);
    setDuplicates((data.duplicates || []).slice(0, 100));
  }

  return (
    <section>
      <h2>Duplicate Detection</h2>
      <div className="row">
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="email">Email</option>
          <option value="phone">Telepon</option>
          <option value="ip_address">IP Address</option>
        </select>
        <button onClick={runDuplicates}>Cari Duplikat</button>
        <span className="sub">{meta}</span>
      </div>
      <table>
        <thead>
          <tr><th>User ID 1</th><th>User ID 2</th><th>Similarity</th></tr>
        </thead>
        <tbody>
          {duplicates.length === 0 ? (
            <tr><td colSpan={3}>Tidak ada duplikat</td></tr>
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
  const [id, setId] = useState('');
  const [out, setOut] = useState('-');

  async function runProfile() {
    const data = await fetchJSON(`/api/user-profile/${id}`);
    setOut(JSON.stringify(data, null, 2));
  }

  return (
    <section>
      <h2>User Profile Lookup</h2>
      <div className="row">
        <input value={id} onChange={(e) => setId(e.target.value)} placeholder="user_id" />
        <button onClick={runProfile}>Lihat Profil</button>
      </div>
      <pre>{out}</pre>
    </section>
  );
}

export default function Page() {
  return (
    <>
      <h1>Customer Intelligence Platform</h1>
      <div className="sub">15M+ customer records &middot; PostgreSQL &middot; Node.js/Express &middot; Next.js</div>
      <StatusCards />
      <SearchSection />
      <DuplicatesSection />
      <ProfileSection />
    </>
  );
}
