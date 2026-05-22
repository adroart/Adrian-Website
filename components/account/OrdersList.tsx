import React, { useEffect, useState } from 'react';
import AccountLayout from './AccountLayout';
import { useAccount } from '../../lib/account/useAccount';

interface OrderItem {
  productId: string;
  description: string;
  quantity: number;
  amountSubtotal: number;
}

interface Order {
  id: number;
  stripeSessionId: string;
  status: string;
  amountTotal: number;
  currency: string;
  createdAt: string;
  items: OrderItem[];
}

const OrdersListInner: React.FC = () => {
  const account = useAccount();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account.isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await account.fetchAuthed('/api/orders/list');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setOrders(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load orders.');
          setOrders([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [account]);

  if (orders === null) {
    return <p className="font-serif text-wood-700">Loading your orders…</p>;
  }
  if (error) {
    return <p className="font-serif text-wood-700">{error}</p>;
  }
  if (orders.length === 0) {
    return (
      <div>
        <p className="font-serif text-wood-700 mb-4">You haven't placed any orders yet.</p>
        <a
          href="/shop"
          className="font-label text-[11px] uppercase tracking-[0.22em] text-bronze-600 hover:text-bronze-700"
        >
          Visit the shop
        </a>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {orders.map((o) => (
        <li key={o.id} className="border border-wood-200 rounded p-4">
          <div className="flex justify-between items-baseline mb-2">
            <div className="font-serif text-lg text-wood-900">
              {new Date(o.createdAt).toLocaleDateString(undefined, {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </div>
            <div className="font-label text-[10px] uppercase tracking-[0.22em] text-bronze-600">
              {o.status}
            </div>
          </div>
          <ul className="text-sm text-wood-700 font-serif space-y-1">
            {o.items.length === 0 && (
              <li className="text-wood-500 italic">Items not recorded</li>
            )}
            {o.items.map((item, i) => (
              <li key={i}>
                {item.quantity} × {item.description || item.productId}
              </li>
            ))}
          </ul>
          <div className="flex justify-between items-baseline mt-3 pt-3 border-t border-wood-100">
            <div className="font-serif text-wood-900">
              {(o.amountTotal / 100).toLocaleString(undefined, {
                style: 'currency',
                currency: o.currency.toUpperCase(),
              })}
            </div>
            <a
              href={`https://dashboard.stripe.com/payments/${o.stripeSessionId}`}
              className="font-label text-[10px] uppercase tracking-[0.22em] text-bronze-600 hover:text-bronze-700"
              target="_blank"
              rel="noopener noreferrer"
            >
              Receipt
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
};

const OrdersList: React.FC = () => (
  <AccountLayout title="Your orders">
    <OrdersListInner />
  </AccountLayout>
);

export default OrdersList;
