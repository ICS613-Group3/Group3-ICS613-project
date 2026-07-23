#!/usr/bin/env bash
set -euo pipefail

echo "===== FULL E2E TEST SUITE ====="
echo ""

API="http://localhost:8000/api/v1"
TODAY=$(date +%Y-%m-%d)
TOMORROW=$(date -d "+1 day" +%Y-%m-%d)

# ── 1. Health check ──
echo "--- 1. Health check ---"
curl -sf "$API/health" && echo " OK"
echo ""

# ── 2. Login (admin) ──
echo "--- 2. Admin login ---"
ADMIN_RESP=$(curl -sf -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"E2eTestPass123!"}')
ADMIN_TOKEN=$(echo "$ADMIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
echo "  Admin logged in OK"
echo ""

# ── 3. GET /auth/me (admin) ──
echo "--- 3. GET /auth/me ---"
curl -sf "$API/auth/me" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "
import sys,json
u=json.load(sys.stdin)
print(f'  User: {u[\"full_name\"]} | Email: {u[\"email\"]} | Admin: {u[\"is_admin\"]} | Status: {u[\"status\"]}')"
echo ""

# ── 4. Login (member01) ──
echo "--- 4. Member01 login ---"
MEMBER_RESP=$(curl -sf -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"member01@example.com","password":"E2eTestPass123!"}')
MEMBER_TOKEN=$(echo "$MEMBER_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
MEMBER_REFRESH=$(echo "$MEMBER_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['refresh_token'])")
echo "  Member01 logged in OK"
echo ""

# ── 5. GET /tools (member01) ──
echo "--- 5. GET /tools ---"
TOOLS_RESP=$(curl -sf "$API/tools" -H "Authorization: Bearer $MEMBER_TOKEN")
TOOL_COUNT=$(echo "$TOOLS_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])")
FIRST_TOOL_ID=$(echo "$TOOLS_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['items'][0]['id'])")
echo "  Tools found: $TOOL_COUNT"
echo "  First tool ID: $FIRST_TOOL_ID"
echo ""

# ── 6. GET /tools/:id ──
echo "--- 6. GET /tools/:id ---"
curl -sf "$API/tools/$FIRST_TOOL_ID" \
  -H "Authorization: Bearer $MEMBER_TOKEN" | python3 -c "
import sys,json
t=json.load(sys.stdin)
print(f'  Tool: {t[\"name\"]} | Owner: {t[\"owner\"][\"full_name\"]} | Category: {t[\"category\"]} | Condition: {t[\"condition\"]} | Active: {t[\"is_active\"]}')"
echo ""

# ── 7. POST /reservations (with today's date) ──
echo "--- 7. POST /reservations ---"
RES_RESP=$(curl -sf -X POST "$API/reservations" \
  -H "Authorization: Bearer $MEMBER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"tool_id\":\"$FIRST_TOOL_ID\",\"start_date\":\"$TODAY\",\"end_date\":\"$TOMORROW\"}")
RES_ID=$(echo "$RES_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
RES_STATE=$(echo "$RES_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['state'])")
echo "  Created reservation: ${RES_ID:0:8}... | State: $RES_STATE"
echo ""

# ── 8. GET /reservations (list) ──
echo "--- 8. GET /reservations ---"
curl -sf "$API/reservations" \
  -H "Authorization: Bearer $MEMBER_TOKEN" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'  Total: {d[\"total\"]}')
for r in d['items']:
    print(f'    {r[\"id\"][:8]}... | {r[\"state\"]} | {r[\"start_date\"]}-{r[\"end_date\"]}')"
echo ""

# ── 9. Approve (owner — member02) ──
echo "--- 9. Approve reservation ---"
OWNER_RESP=$(curl -sf -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"member02@example.com","password":"E2eTestPass123!"}')
OWNER_TOKEN=$(echo "$OWNER_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

APPROVE_RESP=$(curl -sf -X POST "$API/reservations/$RES_ID/approve" \
  -H "Authorization: Bearer $OWNER_TOKEN")
APPROVE_STATE=$(echo "$APPROVE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['state'])")
echo "  Result: $APPROVE_STATE"
echo ""

# ── 10. Mark picked up (borrower — member01) ──
echo "--- 10. POST /reservations/:id/mark-picked-up ---"
PICKUP_RESP=$(curl -sf -X POST "$API/reservations/$RES_ID/mark-picked-up" \
  -H "Authorization: Bearer $MEMBER_TOKEN")
PICKUP_STATE=$(echo "$PICKUP_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['state'])")
PICKUP_TIME=$(echo "$PICKUP_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['picked_up_at'])")
echo "  Result: $PICKUP_STATE | Picked up at: ${PICKUP_TIME:0:19}"
echo ""

# ── 11. Mark returned ──
echo "--- 11. POST /reservations/:id/mark-returned ---"
RETURN_RESP=$(curl -sf -X POST "$API/reservations/$RES_ID/mark-returned" \
  -H "Authorization: Bearer $MEMBER_TOKEN")
RETURN_STATE=$(echo "$RETURN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['state'])")
RETURN_TIME=$(echo "$RETURN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['returned_at'])")
echo "  Result: $RETURN_STATE | Returned at: ${RETURN_TIME:0:19}"
echo ""

# ── 12. POST review ──
echo "--- 12. POST /reservations/:id/review ---"
REVIEW_RESP=$(curl -sf -X POST "$API/reservations/$RES_ID/review" \
  -H "Authorization: Bearer $MEMBER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rating":5,"comment":"Excellent tool, very clean and well maintained!"}')
REVIEW_ID=$(echo "$REVIEW_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
REVIEW_RATING=$(echo "$REVIEW_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['rating'])")
echo "  Review submitted: ${REVIEW_ID:0:8}... | Rating: $REVIEW_RATING/5"
echo ""

# ── 13. GET /notifications ──
echo "--- 13. GET /notifications ---"
curl -sf "$API/notifications" \
  -H "Authorization: Bearer $MEMBER_TOKEN" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'  {d[\"total\"]} total, {d[\"unread_count\"]} unread notifications')
for n in d['items'][:3]:
    print(f'    [{n[\"type\"]}] {n[\"title\"]} | read: {n[\"read_at\"] is not None}')"
echo ""

# ── 14. POST /notifications/:id/read ──
echo "--- 14. POST /notifications/:id/read ---"
NOTIF_RESP=$(curl -sf "$API/notifications" -H "Authorization: Bearer $MEMBER_TOKEN")
FIRST_NOTIF_ID=$(echo "$NOTIF_RESP" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for n in d['items']:
    if not n['read_at']:
        print(n['id'])
        break")
if [ -n "$FIRST_NOTIF_ID" ]; then
  curl -sf -X POST "$API/notifications/$FIRST_NOTIF_ID/read" \
    -H "Authorization: Bearer $MEMBER_TOKEN" > /dev/null
  echo "  Marked as read: ${FIRST_NOTIF_ID:0:8}..."
fi
echo ""

# ── 15. Tool rating updated ──
echo "--- 15. Tool rating after review ---"
curl -sf "$API/tools/$FIRST_TOOL_ID" \
  -H "Authorization: Bearer $MEMBER_TOKEN" | python3 -c "
import sys,json
t=json.load(sys.stdin)
print(f'  {t[\"name\"]}: avg_rating={t[\"avg_rating\"]} | rating_count={t[\"rating_count\"]}')"
echo ""

# ── 16. Admin listing controls ──
echo "--- 16. GET /tools/admin/all ---"
curl -sf "$API/tools/admin/all" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'  {d[\"total\"]} total tools')
for t in d['items'][:4]:
    print(f'    {t[\"name\"]} | active={t[\"is_active\"]} | category={t[\"category\"]}')"
echo ""

# ── 17. Auth refresh ──
echo "--- 17. POST /auth/refresh ---"
curl -sf -X POST "$API/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$MEMBER_REFRESH\"}" | python3 -c "
import sys,json
r=json.load(sys.stdin)
print(f'  New access: {r[\"access_token\"][:16]}... | type={r[\"token_type\"]}')"
echo ""

# ── 18. Logout ──
echo "--- 18. POST /auth/logout ---"
curl -sf -X POST "$API/auth/logout" \
  -H "Authorization: Bearer $MEMBER_TOKEN" | python3 -c "
import sys,json
print(f'  {json.load(sys.stdin)[\"message\"]}')"
echo ""

echo "===== ALL E2E TESTS PASSED ====="
