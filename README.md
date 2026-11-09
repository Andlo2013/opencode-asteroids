# Asteroids

Clon del clásico arcade **Asteroids** implementado en canvas HTML5 puro, sin dependencias ni bundler.

## Descripción

Nave espacial en un campo de asteroides con envolvimiento de bordes (el espacio es toroidal). Destruye asteroides para sumar puntos: los grandes se parten en medianos, los medianos en pequeños. Incluye power-ups especiales y tipos de asteroides únicos como la estrella fugaz.

## Tecnologías

- **HTML5 Canvas** — renderizado 2D
- **JavaScript (ES6+)** — lógica del juego en un solo archivo `game.js`
- Sin frameworks, sin bundler, sin dependencias

## Cómo correr

Abre `index.html` directamente en el navegador (doble clic), o usa un servidor local:

```bash
npx serve .
```

Luego visita `http://localhost:3000`.

## Controles

| Tecla     | Acción     |
| --------- | ---------- |
| `←` `→`   | Rotar nave |
| `↑`       | Propulsar  |
| `Espacio` | Disparar   |
| `S`       | Cambiar skin |

## Skins

Pulsa `S` para cambiar la apariencia de la nave. La elección se guarda en el navegador y se mantiene al recargar.

| Skin       | Estilo                    | Color   |
| ---------- | ------------------------- | ------- |
| Clásica    | Triángulo clásico         | Blanco  |
| Interceptor| Caza con alas en flecha   | Cian    |
| Ovni       | Platillo con cúpula       | Verde   |
| Espectro   | Silueta angular stealth   | Magenta |

Las skins son solo estéticas: no cambian el tamaño de colisión ni la dificultad.

## Puntuación

| Asteroide | Puntos |
| --------- | ------ |
| Grande    | 20     |
| Mediano   | 50     |
| Pequeño   | 100    |
| Estrella fugaz | 150 |

## Características

- 3 vidas con invencibilidad temporal al reaparecer (parpadeo)
- Asteroides se parten en fragmentos más pequeños al ser destruidos
- Partículas de explosión al destruir asteroides
- Power-up de velocidad: duplica la propulsión de la nave durante 5 segundos
- Power-up de triple disparo: durante 5 segundos la nave dispara 3 balas en abanico
- Escudo: power-up que absorbe un único impacto de asteroide y desaparece; se muestra un indicador `ESCUDO` en el HUD
- Estrella fugaz: asteroide especial que se mueve más rápido, deja estela y desaparece tras unos segundos. Da puntos extra y no se fragmenta.
