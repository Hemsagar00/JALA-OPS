-- SYNTHETIC development fixtures. Local use only; not verified district infrastructure.
-- Reapplying this seed preserves changed records. No enabled accounts or passwords.
INSERT INTO stations (id,code,name,locality,is_demo) VALUES
 ('st-puttaparthi','DEMO-PTP','Puttaparthi Pilot Station (Demo)','Puttaparthi',1),
 ('st-dharmavaram','DEMO-DMM','Dharmavaram Pilot Station (Demo)','Dharmavaram',1),
 ('st-hindupur','DEMO-HDP','Hindupur Pilot Station (Demo)','Hindupur',1),
 ('st-penukonda','DEMO-PKD','Penukonda Pilot Station (Demo)','Penukonda',1),
 ('st-kadiri','DEMO-KDR','Kadiri Pilot Station (Demo)','Kadiri',1)
 ON CONFLICT(id) DO NOTHING;
INSERT INTO pumps (id,station_id,code,name,rated_power_kw,capacity_m3_h) VALUES
 ('pump-ptp-1','st-puttaparthi','DEMO-PTP-P01','Duty pump',75,180),
 ('pump-ptp-2','st-puttaparthi','DEMO-PTP-P02','Standby pump',75,180),
 ('pump-dmm-1','st-dharmavaram','DEMO-DMM-P01','Duty pump',110,260),
 ('pump-dmm-2','st-dharmavaram','DEMO-DMM-P02','Standby pump',110,260),
 ('pump-hdp-1','st-hindupur','DEMO-HDP-P01','Duty pump',90,220),
 ('pump-hdp-2','st-hindupur','DEMO-HDP-P02','Standby pump',90,220),
 ('pump-pkd-1','st-penukonda','DEMO-PKD-P01','Duty pump',55,130),
 ('pump-pkd-2','st-penukonda','DEMO-PKD-P02','Standby pump',55,130),
 ('pump-kdr-1','st-kadiri','DEMO-KDR-P01','Duty pump',75,175),
 ('pump-kdr-2','st-kadiri','DEMO-KDR-P02','Standby pump',75,175)
 ON CONFLICT(id) DO NOTHING;
INSERT INTO users (id,username,display_name,role_code,active) VALUES
 ('demo-admin','demo.admin','Demo administrator','SYSTEM_ADMIN',0),
 ('demo-operator','demo.operator','Demo operator','OPERATOR',0),
 ('demo-technician','demo.technician','Demo technician','TECHNICIAN',0),
 ('demo-ae','demo.ae','Demo assistant engineer','AE',0),
 ('demo-collector','demo.collector','Demo district administration','COLLECTOR',0)
 ON CONFLICT(id) DO NOTHING;
INSERT INTO user_station_assignments (user_id,station_id) VALUES
 ('demo-operator','st-puttaparthi'),('demo-technician','st-puttaparthi'),('demo-ae','st-puttaparthi')
 ON CONFLICT(user_id,station_id) DO NOTHING;
