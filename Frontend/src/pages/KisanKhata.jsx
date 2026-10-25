import { useState, useEffect } from 'react';
import { khataService } from '../services/khataService';
import { farmService } from '../services/farmService';
import { TrendingUp, TrendingDown, Wallet, Plus, Trash2, X } from 'lucide-react';
import './KisanKhata.css';

const CATEGORIES = ['Seeds', 'Fertilizers', 'Pesticides', 'Labor', 'Machinery', 'Irrigation', 'Crop Sale', 'Other'];

const KisanKhata = () => {
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterFarm, setFilterFarm] = useState('');
  const [filterCrop, setFilterCrop] = useState('');
  const [form, setForm] = useState({
    title: '', transaction_type: 'expense', category: 'Other',
    amount: '', crop: '', notes: '', farm_id: '',
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAll();
    farmService.getFarms().then(f => setFarms(Array.isArray(f) ? f : [])).catch(() => {});
  }, []);

  useEffect(() => {
    fetchAll();
  }, [filterFarm, filterCrop]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const fId = filterFarm ? parseInt(filterFarm) : null;
      const crop = filterCrop.trim() || null;
      const [e, s] = await Promise.all([
        khataService.getEntries(fId, crop),
        khataService.getSummary(fId, crop),
      ]);
      setEntries(e);
      setSummary(s);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    setFormError('');
    if (!form.title.trim()) return setFormError('Title is required.');
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) return setFormError('Enter a valid amount > 0.');

    try {
      setSubmitting(true);
      await khataService.addEntry({
        title: form.title.trim(),
        transaction_type: form.transaction_type,
        category: form.category,
        amount: parseFloat(form.amount),
        crop: form.crop.trim() || null,
        notes: form.notes.trim() || null,
        farm_id: form.farm_id ? parseInt(form.farm_id) : null,
      });
      setShowAddModal(false);
      setForm({ title: '', transaction_type: 'expense', category: 'Other', amount: '', crop: '', notes: '', farm_id: '' });
      fetchAll();
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to add entry.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction?')) return;
    try {
      await khataService.deleteEntry(id);
      fetchAll();
    } catch (err) {
      console.error(err);
    }
  };

  const netProfit = summary?.net_profit ?? null;
  const isProfit = netProfit !== null && netProfit >= 0;

  return (
    <div className="khata-page">
      {/* Header */}
      <div className="khata-page-header">
        <div>
          <h1>📒 Kisan Khata</h1>
          <p className="khata-page-subtitle">Track your farm income & expenses</p>
        </div>
        <button className="khata-add-btn" onClick={() => setShowAddModal(true)} id="add-entry-btn">
          <Plus size={16} /> Add Entry
        </button>
      </div>

      {/* Summary Cards */}
      <div className="khata-page-summary">
        <div className="khata-summary-card income-card">
          <TrendingUp size={22} />
          <div>
            <span className="ksc-label">Total Income</span>
            <span className="ksc-value">₹{summary ? summary.total_income.toLocaleString('en-IN') : '—'}</span>
          </div>
        </div>
        <div className="khata-summary-card expense-card">
          <TrendingDown size={22} />
          <div>
            <span className="ksc-label">Total Expense</span>
            <span className="ksc-value">₹{summary ? summary.total_expense.toLocaleString('en-IN') : '—'}</span>
          </div>
        </div>
        <div className={`khata-summary-card net-card ${netProfit !== null ? (isProfit ? 'profit' : 'loss') : ''}`}>
          <Wallet size={22} />
          <div>
            <span className="ksc-label">Net {isProfit ? 'Profit' : 'Loss'}</span>
            <span className="ksc-value">
              {netProfit !== null ? `${isProfit ? '+' : '-'}₹${Math.abs(netProfit).toLocaleString('en-IN')}` : '—'}
            </span>
          </div>
        </div>
        <div className="khata-summary-card count-card">
          <span style={{ fontSize: '1.4rem' }}>📋</span>
          <div>
            <span className="ksc-label">Transactions</span>
            <span className="ksc-value">{summary?.entries_count ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="khata-filters">
        <select
          className="khata-filter-select"
          value={filterFarm}
          onChange={e => setFilterFarm(e.target.value)}
          id="filter-farm"
        >
          <option value="">All Farms</option>
          {farms.map(f => <option key={f.id} value={f.id}>{f.farm_name}</option>)}
        </select>
        <input
          className="khata-filter-input"
          placeholder="Filter by crop…"
          value={filterCrop}
          onChange={e => setFilterCrop(e.target.value)}
          id="filter-crop"
        />
      </div>

      {/* Entries Table */}
      <div className="khata-table-wrap">
        {loading ? (
          <div className="khata-page-loading">Loading transactions…</div>
        ) : entries.length === 0 ? (
          <div className="khata-page-empty">
            <span>📒</span>
            <p>No transactions found. Add your first entry!</p>
          </div>
        ) : (
          <table className="khata-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Title</th>
                <th>Category</th>
                <th>Crop</th>
                <th>Type</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id} className={`khata-row ${entry.transaction_type}`}>
                  <td className="khata-td-date">{new Date(entry.date).toLocaleDateString('en-IN')}</td>
                  <td className="khata-td-title">{entry.title}</td>
                  <td><span className="khata-cat-badge">{entry.category}</span></td>
                  <td className="khata-td-crop">{entry.crop || '—'}</td>
                  <td>
                    <span className={`khata-type-badge ${entry.transaction_type}`}>
                      {entry.transaction_type === 'income' ? '💰 Income' : '💸 Expense'}
                    </span>
                  </td>
                  <td className={`khata-td-amount ${entry.transaction_type}`}>
                    {entry.transaction_type === 'income' ? '+' : '-'}₹{entry.amount.toLocaleString('en-IN')}
                  </td>
                  <td>
                    <button
                      className="khata-delete-btn"
                      onClick={() => handleDelete(entry.id)}
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Entry Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-box khata-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📒 Add Transaction</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="khata-form">
              {/* Type Toggle */}
              <div className="khata-type-toggle">
                <button
                  type="button"
                  className={`khata-toggle-btn ${form.transaction_type === 'expense' ? 'active-expense' : ''}`}
                  onClick={() => setForm(f => ({ ...f, transaction_type: 'expense' }))}
                >💸 Expense</button>
                <button
                  type="button"
                  className={`khata-toggle-btn ${form.transaction_type === 'income' ? 'active-income' : ''}`}
                  onClick={() => setForm(f => ({ ...f, transaction_type: 'income' }))}
                >💰 Income</button>
              </div>

              <div className="form-group">
                <label>Title *</label>
                <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Urea purchase" />
              </div>
              <div className="khata-form-row">
                <div className="form-group">
                  <label>Amount (₹) *</label>
                  <input className="form-input" type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="khata-form-row">
                <div className="form-group">
                  <label>Crop (optional)</label>
                  <input className="form-input" value={form.crop} onChange={e => setForm(f => ({ ...f, crop: e.target.value }))} placeholder="e.g. Wheat" />
                </div>
                <div className="form-group">
                  <label>Farm (optional)</label>
                  <select className="form-input" value={form.farm_id} onChange={e => setForm(f => ({ ...f, farm_id: e.target.value }))}>
                    <option value="">None</option>
                    {farms.map(fa => <option key={fa.id} value={fa.id}>{fa.farm_name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Notes (optional)</label>
                <textarea className="form-input khata-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any additional details…" rows={2} />
              </div>

              {formError && <div className="form-error">{formError}</div>}

              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn-submit" disabled={submitting} id="submit-khata-btn">
                  {submitting ? 'Saving…' : 'Add Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default KisanKhata;
