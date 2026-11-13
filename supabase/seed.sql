-- Seed minimal (data lengkap 30 template tersedia di src/templates/registry.ts dan di-seed otomatis pada mode demo)
insert into template_categories (name, slug, icon, sort_order) values
 ('Wedding','wedding','💍',0),('Khitan','khitan','🕌',1),('Aqiqah','aqiqah','🍼',2),('Birthday','birthday','🎂',3),('Graduation','graduation','🎓',4),
 ('Anniversary','anniversary','🥂',5),('Engagement','engagement','💞',6),('Baby Shower','baby-shower','🧸',7),('Event','event','🏢',8),('Lainnya','lainnya','✨',9)
on conflict do nothing;
insert into packages (code, name, price, duration_days, sort_order) values ('free','Free',0,30,0),('basic','Basic',49000,90,1),('premium','Premium',99000,180,2),('exclusive','Exclusive',199000,365,3),('custom','Custom Design',499000,365,4)
on conflict do nothing;
