# EMQX Cloud Complete Setup Guide

Complete instructions for testing LADYBUG with EMQX Cloud, including all test data.

---

## Quick Start (If You Have EMQX Already)

Jump to [Step 6: Test Using WebSocket Client](#step-6-test-using-websocket-client) if your EMQX deployment is already set up.

---

## Step 1: Create EMQX Cloud Account

1. Go to [https://www.emqx.com/en/cloud](https://www.emqx.com/en/cloud)
2. Click **"Start Free"**
3. Create account & verify email
4. Log in to Console

---

## Step 2: Create Serverless Deployment (Free)

1. Click **"New Deployment"**
2. Select **"Serverless"** (free tier)
3. Choose region (e.g., `ap-southeast-1` for Southeast Asia)
4. Name it: `ladybug-mqtt`
5. Click **"Create"**
6. Wait ~2 minutes for deployment

---

## Step 3: Note Connection Details

From the deployment Overview page, note:

| Setting | Value |
|---------|-------|
| **Cluster Address** | `xxxxx.ala.ap-southeast-1.emqxsl.com` |
| **MQTT Port (TLS)** | `8883` |
| **WebSocket Port** | `8084` |

---

## Step 4: Create Authentication

1. Go to **"Access Control"** → **"Authentication"**
2. Click **"Add"**
3. Enter:
   - **Username**: `ladybug`
   - **Password**: `Ladybug2025!`
4. Click **"Confirm"**

---

## Step 5: Configure Webhook (Data Integration)

### 5.1 Create HTTP Resource

1. Go to **"Data Integrations"** in left menu
2. Click **"New Resource"** → **"HTTP Server"**
3. Configure:

| Field | Value |
|-------|-------|
| **Name** | `supabase-ladybug` |
| **URL** | `https://hncumnbxaucdvjcnfptq.supabase.co/functions/v1/mqtt-websocket` |
| **Method** | `POST` |

4. **Add Headers** (click "Add" for each):

| Header Key | Header Value |
|------------|--------------|
| `Content-Type` | `application/json` |
| `apikey` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuY3VtbmJ4YXVjZHZqY25mcHRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5ODQwMDUsImV4cCI6MjA3ODU2MDAwNX0.bX9y8k0Jn_9g6GYs4d5supHdx_yntqrj0kAcvJ_Rdk8` |

5. **Body Template**:
```json
{"topic": "${topic}", "payload": "${payload}"}
```

6. Click **"Test Connection"** → should show success
7. Click **"Save"**

### 5.2 Create Rule

1. Go to **"Data Integrations"** → **"Rules"**
2. Click **"Create"**
3. **SQL**:
```sql
SELECT * FROM "ladybug/#"
```
4. Under **Actions**, select your `supabase-ladybug` resource
5. Click **"Create"**

---

## Step 6: Test Using WebSocket Client

1. Go to **"Diagnose"** → **"WebSocket Client"**
2. Configure connection:
   - **Host**: Your cluster address (without `wss://`)
   - **Port**: `8084`
   - **Path**: `/mqtt`
   - **SSL**: ✓ Enabled
   - **Username**: `ladybug`
   - **Password**: `Ladybug2025!`
3. Click **"Connect"** (should show "Connected")

### Send Test Messages

Copy and send each message one by one:

#### 🟢 Trap 011 - Safe (Green)
| Field | Value |
|-------|-------|
| **Topic** | `ladybug/trap011/status` |
| **Payload** | `3,28,1` |

*Meaning: 3 moths, 28°C, Status 1 (Safe)*

---

#### 🟡 Trap 012 - Moderate (Yellow)
| Field | Value |
|-------|-------|
| **Topic** | `ladybug/trap012/status` |
| **Payload** | `12,31,2` |

*Meaning: 12 moths, 31°C, Status 2 (Moderate)*

---

#### 🔴 Trap 013 - High Risk (Red)
| Field | Value |
|-------|-------|
| **Topic** | `ladybug/trap013/status` |
| **Payload** | `25,35,3` |

*Meaning: 25 moths, 35°C, Status 3 (High Risk)*

---

#### 🟢 Trap 014 - Safe (Green)
| Field | Value |
|-------|-------|
| **Topic** | `ladybug/trap014/status` |
| **Payload** | `2,27,1` |

---

#### 🟡 Trap 015 - Moderate (Yellow)
| Field | Value |
|-------|-------|
| **Topic** | `ladybug/trap015/status` |
| **Payload** | `8,29,2` |

---

#### 🔴 Trap 016 - High Risk (Red)
| Field | Value |
|-------|-------|
| **Topic** | `ladybug/trap016/status` |
| **Payload** | `30,36,3` |

---

#### 🟢 Trap 017 - Safe (Green)
| Field | Value |
|-------|-------|
| **Topic** | `ladybug/trap017/status` |
| **Payload** | `1,26,1` |

---

#### 🟡 Trap 018 - Moderate (Yellow)
| Field | Value |
|-------|-------|
| **Topic** | `ladybug/trap018/status` |
| **Payload** | `10,30,2` |

---

#### 🔴 Trap 019 - High Risk (Red)
| Field | Value |
|-------|-------|
| **Topic** | `ladybug/trap019/status` |
| **Payload** | `22,34,3` |

---

#### 🟢 Trap 020 - Safe (Green)
| Field | Value |
|-------|-------|
| **Topic** | `ladybug/trap020/status` |
| **Payload** | `4,28,1` |

---

## Alternative: Test via cURL (Direct Webhook)

No EMQX needed - test the webhook directly:

```bash
# Trap 011 - Safe
curl -X POST "https://hncumnbxaucdvjcnfptq.supabase.co/functions/v1/mqtt-websocket" \
  -H "Content-Type: application/json" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuY3VtbmJ4YXVjZHZqY25mcHRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5ODQwMDUsImV4cCI6MjA3ODU2MDAwNX0.bX9y8k0Jn_9g6GYs4d5supHdx_yntqrj0kAcvJ_Rdk8" \
  -d '{"topic": "ladybug/trap011/status", "payload": "5,28,1"}'

# Trap 012 - Moderate
curl -X POST "https://hncumnbxaucdvjcnfptq.supabase.co/functions/v1/mqtt-websocket" \
  -H "Content-Type: application/json" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuY3VtbmJ4YXVjZHZqY25mcHRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5ODQwMDUsImV4cCI6MjA3ODU2MDAwNX0.bX9y8k0Jn_9g6GYs4d5supHdx_yntqrj0kAcvJ_Rdk8" \
  -d '{"topic": "ladybug/trap012/status", "payload": "15,32,2"}'

# Trap 013 - High Risk
curl -X POST "https://hncumnbxaucdvjcnfptq.supabase.co/functions/v1/mqtt-websocket" \
  -H "Content-Type: application/json" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuY3VtbmJ4YXVjZHZqY25mcHRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5ODQwMDUsImV4cCI6MjA3ODU2MDAwNX0.bX9y8k0Jn_9g6GYs4d5supHdx_yntqrj0kAcvJ_Rdk8" \
  -d '{"topic": "ladybug/trap013/status", "payload": "30,36,3"}'
```

---

## Message Format Reference

### Status Topic
**Topic**: `ladybug/trap{n}/status`  
**Format**: `moth_count,temperature,status`

| Status Code | Alert Level | Color |
|-------------|-------------|-------|
| `1` | Safe | 🟢 Green |
| `2` | Moderate | 🟡 Yellow |
| `3` | High Risk | 🔴 Red |

**Example**: `5,28,1` = 5 moths, 28°C, Safe

### Location Topic
**Topic**: `ladybug/trap{n}/location`  
**Format**: `latitude,longitude`

**Example**: `15.51848755,121.2739912`

---

## Verification Checklist

After sending test messages:

- [ ] Open LADYBUG dashboard
- [ ] Go to **"Live Traps"** tab
- [ ] Verify trap cards appear with correct:
  - Moth count
  - Temperature
  - Status badge (Safe/Moderate/High Risk)
  - Color-coded background

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Webhook fails | Check apikey header is correct |
| No traps appear | Verify topic format: `ladybug/trap011/status` |
| Wrong status | Check payload format: `count,temp,status` |
| Connection refused | Enable SSL, use port 8084 |

---

## Device ID Reference

| Topic | Device ID |
|-------|-----------|
| `ladybug/trap011/status` | trap011 |
| `ladybug/trap012/status` | trap012 |
| `ladybug/trap013/status` | trap013 |
| `ladybug/trap014/status` | trap014 |
| `ladybug/trap015/status` | trap015 |
| `ladybug/trap016/status` | trap016 |
| `ladybug/trap017/status` | trap017 |
| `ladybug/trap018/status` | trap018 |
| `ladybug/trap019/status` | trap019 |
| `ladybug/trap020/status` | trap020 |
