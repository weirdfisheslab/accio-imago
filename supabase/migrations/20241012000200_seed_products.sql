insert into public.products (id, name, stripe_price_id, is_active)
values ('slides_image_downloader', 'Slides Image Downloader', 'price_1Slt3BJtvN7f2Vx4hWvRdK0Q', true)
on conflict (id) do update
  set name = excluded.name,
      stripe_price_id = excluded.stripe_price_id,
      is_active = excluded.is_active;
