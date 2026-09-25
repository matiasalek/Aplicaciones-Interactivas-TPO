UPDATE categories
SET
  name = CASE name
    WHEN 'Processors' THEN 'Procesadores'
    WHEN 'Graphics Cards' THEN 'Tarjetas gráficas'
    WHEN 'Motherboards' THEN 'Placas madre'
    WHEN 'Memory' THEN 'Memoria RAM'
    WHEN 'Storage' THEN 'Almacenamiento'
    WHEN 'Power Supplies' THEN 'Fuentes de alimentación'
  END,
  description = CASE name
    WHEN 'Processors' THEN 'Procesadores para computadoras de videojuegos y productividad'
    WHEN 'Graphics Cards' THEN 'Tarjetas gráficas dedicadas para videojuegos de alto rendimiento'
    WHEN 'Motherboards' THEN 'Placas madre para plataformas AMD e Intel'
    WHEN 'Memory' THEN 'Kits de memoria RAM DDR4 y DDR5 para computadoras de escritorio'
    WHEN 'Storage' THEN 'Unidades SSD NVMe y almacenamiento de alta capacidad'
    WHEN 'Power Supplies' THEN 'Fuentes de alimentación modulares y no modulares confiables'
  END
WHERE name IN (
  'Processors',
  'Graphics Cards',
  'Motherboards',
  'Memory',
  'Storage',
  'Power Supplies'
);
