-- Site-wide settings: enforced single row via a boolean primary key that can
-- only ever be `true`.
CREATE TABLE site_settings (
    id              BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
    whatsapp_number VARCHAR(20) NOT NULL,
    contact_email   VARCHAR(255) NOT NULL,
    contact_address VARCHAR(255) NOT NULL,
    instagram_url   VARCHAR(1024) NOT NULL DEFAULT '',
    facebook_url    VARCHAR(1024) NOT NULL DEFAULT '',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO site_settings (id, whatsapp_number, contact_email, contact_address)
VALUES (true, '255000000000', 'info@kalourbeautyempire.co.tz', 'Dar es Salaam, Tanzania');

-- Admin-editable copy for the 4 static pages. Body text supports simple
-- "## Heading" lines (rendered as section headings) between blank-line
-- separated paragraphs.
CREATE TABLE static_pages (
    slug       VARCHAR(50) PRIMARY KEY CHECK (slug IN ('about', 'contact', 'privacy', 'terms')),
    title      VARCHAR(255) NOT NULL,
    body       TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO static_pages (slug, title, body) VALUES
('about', 'Kalour Beauty Empire', $body$Kalour Beauty Empire ni jukwaa la biashara mtandaoni linalojishughulisha na manukato halisi, vipodozi bora, na viatu vya kifahari, likiwahudumia wateja kutoka Dar es Salaam na maeneo mengine ya Tanzania.

## Dira Yetu

Kuwa jina linaloongoza katika tasnia ya urembo na vipodozi Afrika Mashariki, tukitoa bidhaa zinazoinua kujiamini na kuangazia uzuri wa asili wa kila mtu.

## Dhamira Yetu

Kutoa manukato ya kipekee, vipodozi vya hali ya juu, na viatu vya kisasa huku tukizingatia viwango vya kimataifa vya ubora na usalama.

Bidhaa zetu nyingi zinaagizwa moja kwa moja kutoka Zanzibar, huku tukisisitiza uhalisi na ubora badala ya bidhaa bandia zinazoongezeka sokoni. Kila bidhaa tunayouza imepitiwa kwa makini ili kuhakikisha unapata thamani halisi ya fedha yako.

Tulianzia Instagram, na sasa tumejenga tovuti hii ili kukupa uzoefu rahisi na wa kuaminika zaidi wa kununua, kuanzia kuvinjari bidhaa kwa undani hadi kufanya mazungumzo ya moja kwa moja nasi kupitia WhatsApp kabla ya kununua.

Asante kwa kuwa sehemu ya safari yetu. Tuko hapa kukuhudumia.$body$),

('contact', 'Tuko Tayari Kukusaidia', $body$Una swali kuhusu bidhaa, punguzo, au uwasilishaji? Wasiliana nasi moja kwa moja kupitia WhatsApp na tutakujibu haraka iwezekanavyo.$body$),

('privacy', 'Faragha Yako Inatuhusu', $body$## Taarifa Tunazokusanya

Tovuti hii haihitaji uunde akaunti wala kutuma nenosiri kununua bidhaa. Taarifa pekee tunazopokea ni zile unazotupatia moja kwa moja unapowasiliana nasi kupitia WhatsApp (kama jina lako na namba ya simu), pamoja na taarifa zisizo za kibinafsi kama vile bidhaa gani zimependwa zaidi (kupitia kitufe cha "Like").

## Jinsi Tunavyotumia Taarifa

Taarifa unazotupatia kupitia WhatsApp zinatumika tu kuhudumia maombi yako ya bidhaa, kujadili bei, na kupanga uwasilishaji. Hatuuzi wala kushiriki taarifa zako binafsi na kampuni au watu wengine wowote kwa madhumuni ya matangazo.

## Vidakuzi (Cookies) na Kifaa Chako

Tovuti hutumia hifadhi ndogo kwenye kivinjari chako (localStorage) kukumbuka mapendeleo yako, kama vile mandhari ya giza/mwanga na bidhaa ulizoshapenda, ili usilazimike kuchagua upya kila unapotembelea.$body$),

('terms', 'Vigezo vya Matumizi', $body$## Bidhaa na Bei

Tunajitahidi kuhakikisha maelezo, picha, na bei za bidhaa zilizoonyeshwa kwenye tovuti hii ni sahihi. Hata hivyo, bei zinaweza kubadilika bila taarifa ya awali, na uthibitisho wa mwisho wa bei hufanyika kupitia mazungumzo ya WhatsApp kabla ya malipo yoyote.

## Utaratibu wa Ununuzi

Tovuti hii haitumii mfumo wa "kikapu" cha kielektroniki wala malipo ya moja kwa moja mtandaoni. Ununuzi wote hukamilishwa kwa kuwasiliana nasi kupitia kitufe cha WhatsApp kilichopo kwenye kila bidhaa, ambapo tutakubaliana kuhusu bei, malipo, na uwasilishaji.

## Uwasilishaji na Marejesho

Utaratibu wa uwasilishaji na masharti ya kurejesha bidhaa hujadiliwa moja kwa moja kupitia WhatsApp kwa kuzingatia aina ya bidhaa na eneo lako. Tafadhali hakikisha umeridhika na maelezo ya bidhaa kabla ya kukamilisha malipo.

## Haki ya Kubadilisha Masharti

Kalour Beauty Empire inahifadhi haki ya kubadilisha vigezo hivi wakati wowote. Endelea kutembelea ukurasa huu kwa masasisho.$body$);

-- Hero slider posters shown on the public homepage.
CREATE TABLE slider_posters (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url     VARCHAR(1024) NOT NULL,
    link_category VARCHAR(50) NOT NULL DEFAULT '' CHECK (link_category IN ('', 'perfume', 'cosmetics', 'shoes')),
    display_order INT NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO slider_posters (image_url, link_category, display_order) VALUES
('https://picsum.photos/seed/kalour-perfume-promo/1600/560', 'perfume', 0),
('https://picsum.photos/seed/kalour-cosmetics-promo/1600/560', 'cosmetics', 1),
('https://picsum.photos/seed/kalour-shoes-promo/1600/560', 'shoes', 2);

CREATE INDEX idx_slider_posters_active_order ON slider_posters (is_active, display_order);
