# Official Seed Recipes — Precision Kitchen (Batch 1)

> 11 recipes / 3 categories / all 4 scaling profiles represented.
> All numbers are established public standards. Amounts in g/ml.
> Format per recipe: profile, anchor/ratios, ingredients (name / amount / unit / scalingRole / percentageValue or ratioGroup+ratioValue), steps (description / durationSeconds / tips / warning).

---

## BAKING (bakers_percentage)

### 1. Basic White Sandwich Loaf
- profile: bakers_percentage · anchor: Bread flour
- Ingredients:
  - Bread flour · 500 g · anchor · 100%
  - Water (lukewarm) · 325 g · percentage · 65%
  - Sugar · 30 g · percentage · 6%
  - Unsalted butter (softened) · 30 g · percentage · 6%
  - Salt · 10 g · percentage · 2% · correction: {above_factor:4, multiply:0.75}
  - Instant yeast · 5 g · percentage · 1% · correction: {above_factor:3, multiply:0.75}
- Steps:
  1. Mix flour, sugar, yeast; add water and knead 8 min until shaggy. — tips: hold back 20g water, add if dry · warning: Water must be below 40°C / 104°F — hotter water kills the yeast
  2. Add salt and butter; knead 10 min to windowpane stage. (600s) — tips: dough should stretch thin without tearing
  3. Bulk ferment covered until doubled. (3600s) — tips: ~1h at 26°C; longer if cooler
  4. Punch down, shape into loaf, place in greased tin; proof until 1cm above rim. (2700s)
  5. Bake at 180°C / 356°F for 30–35 min. (2100s) — warning: Do not open the oven during the first 20 minutes — the loaf will collapse
  6. Turn out and cool on a rack ≥1h before slicing. (3600s) — tips: slicing warm ruins the crumb

### 2. Rustic Baguette
- profile: bakers_percentage · anchor: Bread flour
- Ingredients:
  - Bread flour · 500 g · anchor · 100%
  - Water · 360 g · percentage · 72%
  - Salt · 10 g · percentage · 2% · correction: {above_factor:4, multiply:0.75}
  - Instant yeast · 3 g · percentage · 0.6% · correction: {above_factor:3, multiply:0.75}
- Steps:
  1. Mix all to a rough dough; rest 30 min (autolyse+). (1800s)
  2. 3 sets of stretch-and-folds, 30 min apart. (5400s) — tips: wet hands prevent sticking
  3. Cold retard in fridge 12–16h. (43200s) — tips: flavor develops overnight
  4. Divide, pre-shape, rest 20 min, shape into baguettes. (1200s) — warning: Handle gently — degassing now destroys the open crumb
  5. Proof 45 min; score 3–4 cuts. (2700s)
  6. Bake at 240°C / 464°F with steam, 22–25 min. (1500s) — tips: a tray of boiling water on the oven floor works as steam

### 3. Classic Cream Scones
- profile: bakers_percentage · anchor: All-purpose flour
- Ingredients:
  - All-purpose flour · 250 g · anchor · 100%
  - Cold unsalted butter (cubed) · 62 g · percentage · 25%
  - Sugar · 38 g · percentage · 15%
  - Baking powder · 12 g · percentage · 5% · correction: {above_factor:3, multiply:0.75}
  - Salt · 3 g · percentage · 1.2%
  - Cold milk · 125 g · percentage · 50%
- Steps:
  1. Rub cold butter into dry mix until pea-sized bits remain. — warning: Keep the butter cold — melted butter makes dense, greasy scones
  2. Add milk; fold just until it holds together. — warning: Do not overwork the dough — overmixing makes scones tough, not flaky
  3. Pat 3cm thick, cut rounds, chill 15 min. (900s)
  4. Bake at 200°C / 392°F for 14–16 min until golden. (960s)

### 4. Fudgy Brownies
- profile: bakers_percentage · anchor: All-purpose flour
- Ingredients:
  - All-purpose flour · 125 g · anchor · 100%
  - Dark chocolate (70%) · 150 g · percentage · 120%
  - Unsalted butter · 175 g · percentage · 140%
  - Sugar · 250 g · percentage · 200%
  - Eggs · 150 g · percentage · 120%
  - Cocoa powder · 30 g · percentage · 24%
  - Salt · 3 g · percentage · 2.4%
- Steps:
  1. Melt chocolate and butter together over low heat; cool 5 min. (300s) — warning: Chocolate scorches above 50°C / 122°F — melt low and slow
  2. Whisk eggs and sugar 2 min until pale; stream in chocolate. (120s)
  3. Fold in flour, cocoa, salt just until no dry streaks.
  4. Bake at 175°C / 347°F for 22–25 min. (1440s) — warning: Pull them while the center still looks slightly underdone — overbaking kills the fudgy texture · tips: a tester should come out with moist crumbs, not clean

---

## COFFEE (ratio_based)

### 5. V60 Pour Over
- profile: ratio_based · ratio coffee:water = 1:15 (locked ratio)
- Ingredients:
  - Coffee (medium-fine grind) · 20 g · anchor(coffee)
  - Water (92–96°C) · 300 g · ratio_linked(water)
- Steps:
  1. Rinse filter with hot water; discard rinse water. — tips: removes paper taste, preheats brewer
  2. Bloom: pour 40–50g water over grounds. (45s) — tips: grounds should bubble and swell
  3. First pour to 150g in slow spirals. (30s)
  4. Second pour to 300g total. (30s) — warning: Water above 96°C / 205°F scorches the grounds and turns the cup bitter
  5. Drawdown should finish around 2:30–3:00 total. (75s) — tips: too fast = grind finer, too slow = grind coarser

### 6. French Press
- profile: ratio_based · ratio coffee:water = 1:12 (locked ratio)
- Ingredients:
  - Coffee (coarse grind) · 30 g · anchor(coffee)
  - Water (93–96°C) · 360 g · ratio_linked(water)
- Steps:
  1. Add coffee, pour all water, stir once gently. (30s)
  2. Lid on, plunger up; steep 4 minutes. (240s) — warning: Do not press early — under-steeped coffee is sour and thin
  3. Press slowly and evenly. (20s) — tips: hard pressing forces bitter fines through
  4. Pour immediately into cups. — tips: coffee left on the grounds keeps extracting and turns bitter

### 7. Cold Brew Concentrate
- profile: ratio_based · ratio coffee:water = 1:8 (locked ratio)
- Ingredients:
  - Coffee (coarse grind) · 100 g · anchor(coffee)
  - Cold filtered water · 800 g · ratio_linked(water)
- Steps:
  1. Combine coffee and water in a jar; stir so all grounds are wet.
  2. Steep in fridge 12–18 hours. (57600s) — warning: Past 24 hours it turns woody and over-extracted
  3. Strain through a fine filter twice. — tips: paper filter for a cleaner cup
  4. Dilute 1:1 with water or milk to serve. — tips: keeps 1 week refrigerated

---

## DRINKS (multi_ratio + linear_legacy)

### 8. Negroni
- profile: multi_ratio · one parts group gin:campari:sweet vermouth = 1:1:1
- Ingredients:
  - Gin · 30 ml · ratio_linked · group "spirits" · ratioValue 1
  - Campari · 30 ml · ratio_linked · group "spirits" · ratioValue 1
  - Sweet vermouth · 30 ml · ratio_linked · group "spirits" · ratioValue 1
- Steps:
  1. Add all to a mixing glass with ice; stir 20–30s. (25s) — warning: Stir, don't shake — shaking clouds the drink and over-dilutes
  2. Strain over a large ice cube; garnish with an orange peel. — tips: express the peel oils over the surface first

### 9. Margarita (3-2-1)
- profile: multi_ratio · parts tequila:triple sec:lime = 3:2:1
- Ingredients:
  - Tequila blanco · 45 ml · ratio_linked · group "mix" · ratioValue 3
  - Triple sec · 30 ml · ratio_linked · group "mix" · ratioValue 2
  - Fresh lime juice · 15 ml · ratio_linked · group "mix" · ratioValue 1
- Steps:
  1. Shake all with ice, hard, 12–15s. (15s) — warning: Bottled lime juice ruins this drink — fresh only
  2. Strain into a salt-rimmed glass over fresh ice. — tips: rim only half the glass so the drinker can choose

### 10. Classic Milk Tea
- profile: multi_ratio · parts group tea:water = 1:12 · sugar 8% of water · milk 30% of water (percentBase = water member)
- Ingredients:
  - Black tea leaves · 10 g · ratio_linked · group "tea_base" · ratioValue 1
  - Hot water (95°C) · 120 g · ratio_linked · group "tea_base" · ratioValue 12
  - Sugar · 9.6 g · percentage · 8% · percentBase: water
  - Whole milk · 36 g · percentage · 30% · percentBase: water
- Steps:
  1. Steep tea in hot water 4–5 min, covered. (270s) — warning: Steeping past 6 minutes turns the base harshly bitter
  2. Strain out leaves; stir sugar in while hot.
  3. Add milk; serve hot or over ice. — tips: warm the milk first for a smoother hot version

### 11. Espresso Martini
- profile: multi_ratio · parts vodka:coffee liqueur:espresso = 5:2:3, plus fixed syrup
- Ingredients:
  - Vodka · 50 ml · ratio_linked · group "mix" · ratioValue 5
  - Coffee liqueur · 20 ml · ratio_linked · group "mix" · ratioValue 2
  - Fresh espresso (hot) · 30 ml · ratio_linked · group "mix" · ratioValue 3
  - Sugar syrup · 10 ml · fixed
- Steps:
  1. Pull the espresso last — it must be fresh and hot when it hits the shaker. — warning: Stale espresso won't foam — the signature crema layer depends on fresh crema
  2. Shake everything with ice, very hard, 15s. (15s) — tips: hard shake builds the foam
  3. Double-strain into a chilled coupe; garnish 3 coffee beans.

---

## Seed notes for implementation
- All recipes: status=published, isPublic=true, author=official (openid IS NULL pattern).
- Baking recipes carry scaling_correction on salt/yeast/baking powder as noted (reuse existing correction jsonb).
- Milk tea percentBase must point at the **water member** ({id}), same as the previous 珍珠奶茶 fix — not the group.
- Espresso Martini's syrup is scalingRole=fixed (doesn't scale with parts) — intentional, tests the fixed role in multi_ratio.
- durationSeconds present where steps are timed → brew mode works out of the box for V60/French press/bread bakes.
