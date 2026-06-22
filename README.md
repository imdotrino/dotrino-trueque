# Trueque

> **Parte del ecosistema [Dotrino](https://dotrino.com).** Misión: aplicaciones que resuelven problemas comunes, respetando tu privacidad — sin anuncios, sin cookies, sin rastreo de datos, sin vender tu identidad a nadie.

Anuncios **georreferenciados efímeros** cerca tuyo. Publicás *vendo / regalo /
busco*, descubrís lo que hay alrededor por radio, y cerrás el trato por
mensajería. El anuncio vive **como máximo 24 h** y **no se guarda tu ubicación
ni tu historial**.

Primera app del ecosistema Dotrino sobre el pilar de **descubrimiento geo**
(`geo.dotrino.com`).

## Cómo funciona

1. **Publicás** un pin firmado con tu identidad del vault (`id.dotrino.com`):
   `{ kind, title, price? }` + tu posición. Un pin por identidad (se reemplaza,
   sin historial), TTL ≤ 24 h.
2. **Descubrís** por radio con `queryRadius` (PostGIS). Vista de **radar de
   proximidad** sin tiles de terceros — nadie ve tu mapa.
3. **Contactás** al dueño de un anuncio: el mensaje va por el **proxy**
   (`sendByPubkey`) y cae en su messenger. El trato real ocurre ahí, no en el
   índice geo.

## Piezas del ecosistema que usa

- `@dotrino/geo` — cliente del índice geo (publicar/consultar).
- `@dotrino/identity` — vault: firma los pines y los mensajes.
- `@dotrino/proxy-client` — transporte para el contacto.
- `@dotrino/store` — almacén del usuario (preferencias/datos).
- `<dotrino-support>` — UI de soporte del ecosistema.

## Privacidad

No hay backend que guarde anuncios de forma durable: el índice geo es efímero
(overwrite, sin trails, purga continua). El contenido compartible no viaja por el
servidor de la app. SEO/analítica solo de la cáscara (GoatCounter cookieless),
nunca de tu contenido. Ver `CLAUDE.md` del ecosistema.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/
```

Despliegue: GitHub Pages vía Actions (`.github/workflows/deploy.yml`) a
`https://trueque.dotrino.com/`.

---

Parte del ecosistema **[Dotrino](https://dotrino.com/)** · *tu información,
en tu servidor, bajo tus reglas*.
