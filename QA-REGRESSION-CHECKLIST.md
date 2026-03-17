## Regression checklist (Orders / Take Away / Modifications)

### Customer (menu/checkout)
- **DINE IN** selected
  - Table number is **required** and **numeric-only**.
  - Order places successfully and items/quantities match the cart.
- **TAKE AWAY** selected
  - Table number is disabled/cleared.
  - Order places successfully and items/quantities match the cart.
  - No screen shows quantities as `0 0 0`.

### Employee (incoming + modification)
- Accept order
  - `acceptedAt` starts timer immediately.
  - No WhatsApp status message opens before payment is marked **PAID**.
- Remove item (unavailable)
  - Removed item disappears from employee and admin order details views.
  - Total amount updates correctly.
  - Removed-items report does not duplicate the same removed item on repeated saves.

### Admin (order details)
- Order details show only non-removed items.
- Totals and quantities are consistent (sum of line totals equals total amount).

