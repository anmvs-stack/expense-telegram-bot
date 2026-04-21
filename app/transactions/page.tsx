'use client';

import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import {
  fetchTransactions,
  updateTransaction,
  deleteTransaction,
} from '@/lib/queries';
import { supabase } from '@/lib/supabaseClient';

export default function TransactionsPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [search, setSearch] = useState('');
  const [minAmount, setMinAmount] = useState<number | undefined>();
  const [maxAmount, setMaxAmount] = useState<number | undefined>();

  // Pagination
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<any>({});

  // Dropdown data
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  async function loadData() {
    setLoading(true);

    const startDate = dayjs(month).startOf('month').format('YYYY-MM-DD');
    const endDate = dayjs(month).endOf('month').format('YYYY-MM-DD');

    const result = await fetchTransactions({
      startDate,
      endDate,
      search,
      minAmount,
      maxAmount,
      limit: pageSize,
      offset: page * pageSize,
    });

    setData(result);
    setLoading(false);
  }

  async function loadMeta() {
    const { data: cat } = await supabase.from('categories').select('id,name');
    const { data: acc } = await supabase.from('accounts').select('id,name');

    setCategories(cat || []);
    setAccounts(acc || []);
  }

  useEffect(() => {
    loadData();
  }, [month, page]);

  useEffect(() => {
    loadMeta();
  }, []);

  function startEdit(row: any) {
    setEditingId(row.id);
    setEditRow({ ...row });
  }

  async function saveEdit() {
    await updateTransaction({
      txn_id: editingId!,
      new_amount: editRow.amount,
      new_description: editRow.description,
      new_category_id: editRow.category_id,
      new_account_id: editRow.account_id,
      new_type: editRow.type,
      new_date: editRow.transaction_date,
    });

    setEditingId(null);
    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this transaction?')) return;
    await deleteTransaction(id);
    loadData();
  }

  return (
    <div className="p-6 space-y-4">

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <input
          type="month"
          value={month}
          onChange={(e) => {
            setPage(0);
            setMonth(e.target.value);
          }}
          className="border p-2 rounded"
        />

        <input
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 rounded"
        />

        <button
          onClick={() => {
            setPage(0);
            loadData();
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Apply
        </button>
      </div>

      {/* Table */}
      <table className="w-full text-sm border">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Date</th>
            <th>Description</th>
            <th>Category</th>
            <th>Account</th>
            <th>Amount</th>
            <th>Type</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td colSpan={7} className="text-center p-4">
                Loading...
              </td>
            </tr>
          ) : (
            data.map((row) => {
              const isEditing = editingId === row.id;

              return (
                <tr key={row.id} className="border-t">

                  {/* Date */}
                  <td className="p-2">
                    {isEditing ? (
                      <input
                        type="date"
                        value={editRow.transaction_date}
                        onChange={(e) =>
                          setEditRow({ ...editRow, transaction_date: e.target.value })
                        }
                      />
                    ) : (
                      dayjs(row.transaction_date).format('DD MMM')
                    )}
                  </td>

                  {/* Description */}
                  <td>
                    {isEditing ? (
                      <input
                        value={editRow.description}
                        onChange={(e) =>
                          setEditRow({ ...editRow, description: e.target.value })
                        }
                      />
                    ) : (
                      row.description
                    )}
                  </td>

                  {/* Category */}
                  <td>
                    {isEditing ? (
                      <select
                        value={editRow.category_id}
                        onChange={(e) =>
                          setEditRow({ ...editRow, category_id: e.target.value })
                        }
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      row.category_name
                    )}
                  </td>

                  {/* Account */}
                  <td>
                    {isEditing ? (
                      <select
                        value={editRow.account_id}
                        onChange={(e) =>
                          setEditRow({ ...editRow, account_id: e.target.value })
                        }
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      row.account_name
                    )}
                  </td>

                  {/* Amount */}
                  <td>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editRow.amount}
                        onChange={(e) =>
                          setEditRow({ ...editRow, amount: Number(e.target.value) })
                        }
                      />
                    ) : (
                      `₹ ${row.amount}`
                    )}
                  </td>

                  {/* Type */}
                  <td>
                    {isEditing ? (
                      <select
                        value={editRow.type}
                        onChange={(e) =>
                          setEditRow({ ...editRow, type: e.target.value })
                        }
                      >
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                      </select>
                    ) : (
                      row.type
                    )}
                  </td>

                  {/* Actions */}
                  <td className="flex gap-2 p-2">
                    {isEditing ? (
                      <>
                        <button onClick={saveEdit} className="text-green-600">
                          Save
                        </button>
                        <button onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(row)} className="text-blue-600">
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(row.id)}
                          className="text-red-600"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>

                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="flex justify-between">
        <button disabled={page === 0} onClick={() => setPage(page - 1)}>
          Prev
        </button>
        <span>Page {page + 1}</span>
        <button onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}