# JALA-OPS — Product Requirements Document

## Product
**JALA-OPS — Pumping & Water Operations Monitoring System**  
Sri Sathya Sai District, Andhra Pradesh.

## Goal
Build one operational system with:
- Android-first field mobile app for operators and technicians;
- web monitoring dashboard for Collector, Control Room, AE, DE, EE and SE;
- one shared backend and one source of truth.

Target: **10-day MVP** with a **₹0–₹3,000 pilot budget**.

## Core loop
**Record → Validate → Calculate → Compare → Alert → Assign → Rectify → Verify → Close**

## MVP scope
### Mobile
- Login
- Home / My Station
- Pump status
- Start Pump
- Stop Pump
- Enter Reading
- Report Breakdown
- Breakdown Detail
- Maintenance / Tasks
- Alerts
- Attendance
- Profile
- GPS + photo capture
- Offline queue + resync

### Web
- Executive Overview
- Pumping Stations
- Station Detail
- Pump Detail
- Water Balance
- Breakdowns
- Alerts
- Data Compliance
- Reports
- Administration

## Roles
Operator, Technician, AE, DE, EE, SE, Collector / District Administration, System Admin.

## Core data
Stations, Pumps, Equipment, Pump Operations, Station Readings, Water Transfers, Breakdowns, Maintenance, Manpower, Alerts, SOPs, Audit Logs.

## Key calculations
- Running Time = Stop Time − Start Time
- Water Pumped = Closing Flow Meter − Opening Flow Meter
- Energy Consumed = Closing Energy Meter − Opening Energy Meter
- Water Difference = Sent − Received
- Water Difference % = Difference / Sent × 100
- Data Compliance % = Actual Readings / Expected Readings × 100

## Alerts
No Data, Breakdown, High Water Difference, Pressure Abnormality, Tank Level Abnormality, Maintenance Due/Overdue, Staff Shortage, Repeated Breakdown, High Energy Use, Target Shortfall.

## Collector dashboard
Must show within 5 seconds:
Target, Pumped, Delivered, Difference, Running, Attention, Breakdown, No Data, Critical Alerts, Network Status, Water Loss/Deficit, Data Compliance.

## Acceptance criteria
1. Operator logs in and sees assigned station.
2. Start Pump updates dashboard to RUNNING.
3. Stop Pump calculates runtime/water/energy.
4. Offline reading syncs once after connectivity returns.
5. Breakdown ticket appears on web.
6. Ticket can be assigned, repaired, verified and closed.
7. Water balance calculates correctly.
8. No-data alerts are generated automatically.
9. Dashboard totals come from stored data.
10. Audit trail captures critical changes.
