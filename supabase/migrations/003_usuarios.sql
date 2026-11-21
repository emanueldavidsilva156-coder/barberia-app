-- PASO 4 · Conectar cada usuario con su rol
--
-- ANTES de ejecutar esto, creá los 4 usuarios en
-- Supabase > Authentication > Users > Add user > Create new user,
-- tildando "Auto Confirm User", con estos correos:
--
--   Usuario en la app   Correo en Supabase
--   ema                 barber.radikal+ema@gmail.com
--   diego               barber.radikal+diego@gmail.com
--   lionel              barber.radikal+lionel@gmail.com
--   barbero4            barber.radikal+barbero4@gmail.com
--
-- En la app cada uno entra solo con su usuario (ema, diego...) y su contraseña.
-- Los correos con "+" llegan a la casilla de barber.radikal@gmail.com, así que
-- si alguien olvida la contraseña, el correo de recuperación llega a la barbería.

INSERT INTO public.profiles (user_id, username, display_name, role, barber_id, active)
SELECT u.id, v.username, v.display_name, v.role, b.id, v.active
FROM (VALUES
  ('ema',      'Ema',       'admin',  'Ema',       true),
  ('diego',    'Diego',     'barber', 'Diego',     true),
  ('lionel',   'Lionel',    'barber', 'Lionel',    true),
  ('barbero4', 'Barbero 4', 'barber', 'Barbero 4', false)
) AS v(username, display_name, role, barber_name, active)
JOIN auth.users AS u ON lower(u.email) = lower('barber.radikal+' || v.username || '@gmail.com')
JOIN public.barbers AS b ON b.name = v.barber_name
ON CONFLICT (user_id) DO UPDATE
SET username = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    barber_id = EXCLUDED.barber_id;

-- Comprobación: tienen que aparecer los 4. Si falta alguno, revisá que el correo
-- esté escrito exactamente igual en Authentication > Users.
SELECT v.username AS usuario,
       COALESCE(p.role, '⚠ FALTA CREAR EL USUARIO') AS rol,
       p.active AS habilitado
FROM (VALUES ('ema'), ('diego'), ('lionel'), ('barbero4')) AS v(username)
LEFT JOIN public.profiles AS p ON p.username = v.username
ORDER BY v.username;
