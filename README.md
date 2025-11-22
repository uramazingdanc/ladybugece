# LADYBUG - IoT Pest Monitoring System

An integrated pest management (IPM) dashboard for monitoring moth populations and environmental conditions across farms using IoT devices.

## 🌟 Features

- **Real-time Dashboard**: Monitor farm alert statuses (Green/Yellow/Red) in real-time
- **Interactive Map**: Visualize farm locations with color-coded alert pins using OpenLayers
- **Device Management**: Track and manage ESP32 IoT monitoring devices
- **MQTT Integration**: Receive data from field devices via EMQX Cloud
- **Automated Alerts**: Automatic email notifications for high-risk (Red) alert conditions
- **Government Dashboard**: Aggregate view for agricultural agencies
- **PWA Support**: Install on mobile devices for field use

## 🏗️ Architecture

```
ESP32 Devices (Field) 
    ↓ MQTT (TLS)
EMQX Cloud Broker 
    ↓ HTTP Webhook
Supabase Edge Function (mqtt-bridge)
    ↓
Supabase Edge Function (ingest-data)
    ↓
PostgreSQL Database
    ↓
React Dashboard (PWA)
```

## 📚 Documentation

### Setup Guides
- **[EMQX_CLOUD_SETUP.md](./EMQX_CLOUD_SETUP.md)** - Complete guide for MQTT broker setup (START HERE)
- **[MQTT_BRIDGE_SETUP.md](./MQTT_BRIDGE_SETUP.md)** - Overview of the webhook integration
- **[PWA_SETUP.md](./PWA_SETUP.md)** - Progressive Web App installation guide
- **[IMPLEMENTATION_COMPLETE.md](./IMPLEMENTATION_COMPLETE.md)** - Full feature documentation

### Deprecated
- ~~HIVEMQ_HTTP_SETUP.md~~ - Use EMQX instead (HiveMQ Cloud Starter lacks webhooks)
- ~~MAKE_MQTT_SETUP.md~~ - Old Make.com approach (no longer needed)

## 🚀 Quick Start

### 1. MQTT Broker Setup (EMQX Cloud)
Follow **[EMQX_CLOUD_SETUP.md](./EMQX_CLOUD_SETUP.md)** to:
- Create free EMQX Cloud serverless deployment
- Configure authentication credentials
- Set up HTTP webhook to Supabase

### 2. Backend (Lovable Cloud / Supabase)
The backend is already deployed with the following Edge Functions:
- `mqtt-bridge` - Receives HTTP webhooks from EMQX
- `ingest-data` - Processes and stores sensor data
- `calculate-alerts` - Computes farm alert levels
- `send-alert-email` - Sends email notifications for Red alerts

### 3. Frontend Dashboard
- Public dashboard accessible at the deployed URL
- Displays real-time farm statuses on interactive map
- Analytics charts showing alert distributions and trends
- Device monitoring and management interface

### 4. ESP32 Device Configuration
Update your ESP32 code with EMQX Cloud credentials:
```cpp
const char* mqtt_server = "xxx.emqxsl.com";  // Your EMQX cluster
const int mqtt_port = 8883;                   // TLS port
const char* mqtt_user = "ladybugdevice";      
const char* mqtt_password = "@Ladybug2025";   
const char* mqtt_topic = "LADYBUG/farm_data";
```

Publish JSON payloads:
```json
{
  "device_id": "ESP_FARM_001",
  "moth_count": 12,
  "temperature_c": 28.5,
  "computed_degree_days": 152.0,
  "computed_status": "yellow_medium_risk"
}
```

## 📊 Data Flow

1. **ESP32 Device** measures moth count and temperature
2. **Device** publishes MQTT message to `LADYBUG/farm_data` topic on EMQX Cloud
3. **EMQX Data Integration** forwards message via HTTP webhook
4. **Supabase Edge Function** receives and processes the payload
5. **Database** stores reading and updates alert status
6. **Dashboard** displays updated farm status in real-time
7. **Email Alert** (if Red status) notifies stakeholders

## 🛠️ Tech Stack

### Frontend
- React 18 + TypeScript
- Vite build tool
- Tailwind CSS for styling
- shadcn/ui component library
- OpenLayers for mapping
- Recharts for analytics
- React Query for data fetching
- Capacitor for PWA/mobile support

### Backend (Lovable Cloud / Supabase)
- PostgreSQL database with Row Level Security
- Supabase Edge Functions (Deno runtime)
- Real-time subscriptions
- Automated alert calculations

### IoT Integration
- EMQX Cloud (MQTT broker with HTTP webhooks)
- ESP32 devices (field sensors)
- MQTT over TLS (port 8883)

## 🗂️ Project Structure

```
├── src/
│   ├── components/
│   │   ├── dashboard/      # Dashboard components
│   │   ├── map/            # Map visualization
│   │   └── ui/             # shadcn/ui components
│   ├── pages/              # Route pages
│   ├── integrations/       # Supabase client
│   └── main.tsx            # App entry point
├── supabase/
│   └── functions/          # Edge Functions
│       ├── mqtt-bridge/    # HTTP webhook receiver
│       ├── ingest-data/    # Data processor
│       ├── calculate-alerts/
│       └── send-alert-email/
├── public/                 # PWA assets
└── capacitor.config.ts     # Mobile config
```

## 🔒 Security Features

- Row Level Security (RLS) policies on all tables
- Public read access for dashboard (no auth required for viewing)
- Secure MQTT over TLS
- Service role key protection in Edge Functions
- CORS headers for webhook endpoints

## 📱 Mobile Support

The dashboard is a Progressive Web App (PWA):
- Install on mobile devices (iOS/Android)
- Offline capability
- App-like experience
- Fast loading with service workers

See [PWA_SETUP.md](./PWA_SETUP.md) for installation instructions.

## 🌍 Target Deployment

- **Region**: Philippines
- **Use Case**: Agricultural pest monitoring
- **Users**: Farmers and government agricultural agencies
- **Devices**: ESP32-based IoT sensors in farm fields

## 🤝 Contributing

This is an IoT + web dashboard integration project for agricultural pest management. Key areas for contribution:
- ESP32 firmware improvements
- Dashboard UI/UX enhancements
- Additional analytics features
- Alert notification channels (SMS, push notifications)

## 📝 License

[Your License Here]

## 🆘 Support

For setup issues:
1. Check the relevant guide in the documentation list above
2. Review Edge Function logs in Supabase dashboard
3. Monitor EMQX Cloud metrics for MQTT connectivity
4. Check browser console for frontend errors

---

**Made with ❤️ for farmers and agricultural monitoring**
