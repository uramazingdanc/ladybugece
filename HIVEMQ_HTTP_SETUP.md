# ⚠️ DEPRECATED: HiveMQ HTTP Setup

## This Guide is No Longer Used

**HiveMQ Cloud Starter plan does NOT include the HTTP Extension feature.**

We have migrated to **EMQX Cloud**, which offers HTTP webhooks on the free tier.

---

## 👉 Use the New Guide Instead

Please follow: **[EMQX_CLOUD_SETUP.md](./EMQX_CLOUD_SETUP.md)**

---

## Why the Change?

- HiveMQ Cloud HTTP Extension is only available on paid plans
- EMQX Cloud includes HTTP webhooks on the free Serverless tier
- EMQX provides better value for small-scale deployments
- The webhook functionality is identical—no code changes needed

---

## Migration Notes

If you were previously using HiveMQ Cloud:

1. Export any important data or configuration
2. Follow the EMQX Cloud setup guide
3. Update ESP32 device connection settings to point to EMQX
4. The Supabase `mqtt-bridge` Edge Function works with both (it's just HTTP)

The architecture remains the same:
```
ESP Devices → MQTT Broker → HTTP Webhook → Supabase → Database
```

Only the MQTT broker changed from HiveMQ to EMQX.

---

## Quick Migration Checklist

- [ ] Create EMQX Cloud serverless deployment
- [ ] Copy authentication credentials (username/password)
- [ ] Configure Data Integration HTTP webhook rule
- [ ] Update ESP32 connection code:
  ```cpp
  // OLD (HiveMQ)
  const char* mqtt_server = "xxx.hivemq.cloud";
  
  // NEW (EMQX)
  const char* mqtt_server = "xxx.emqxsl.com";
  ```
- [ ] Test with EMQX WebSocket client
- [ ] Verify data appears in Supabase database

No changes needed to the Supabase Edge Function!
