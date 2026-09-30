#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(here, '../v4/index.html');
const outputPath = path.join(here, 'index.html');

const source = fs.readFileSync(sourcePath, 'utf8');
const templateMatch = source.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/);

if (!templateMatch) throw new Error('Could not find the v4 bundled template.');

let template = JSON.parse(templateMatch[1]);

function replaceOnce(input, before, after, label = before.slice(0, 80)) {
  const first = input.indexOf(before);
  if (first === -1) throw new Error(`Missing replacement target: ${label}`);
  if (input.indexOf(before, first + before.length) !== -1) {
    throw new Error(`Replacement target is not unique: ${label}`);
  }
  return input.slice(0, first) + after + input.slice(first + before.length);
}

function replaceAllRequired(input, before, after, expected, label = before.slice(0, 80)) {
  const count = input.split(before).length - 1;
  if (count !== expected) {
    throw new Error(`Expected ${expected} replacements for ${label}, found ${count}`);
  }
  return input.split(before).join(after);
}

const titleV4 = 'EZClean Pros | Residential & Commercial Cleaning San Diego';
const titleV5 = 'House Cleaning Services in San Diego, CA | EZClean Pros';
const descriptionV4 = 'Residential and commercial cleaning across San Diego: vacation rental & Airbnb turnovers, deep cleans, offices, real estate turnovers. Call (858) 370-5205.';
const descriptionV5 = 'Reliable house cleaning services in San Diego with trusted professionals, detailed checklists and consistent service. Get a free quote from EZClean Pros.';

template = replaceAllRequired(template, titleV4, titleV5, 3, 'template SEO title');
template = replaceAllRequired(template, descriptionV4, descriptionV5, 4, 'template SEO description');

template = replaceOnce(
  template,
  `<a href="#contact" style="color:{{ linkColor }}; font-size:15px; font-weight:500; transition:color .3s;">{{ t.navContact }}</a>`,
  `<a href="#faq" style="color:{{ linkColor }}; font-size:15px; font-weight:500; transition:color .3s;">{{ t.navFaq }}</a>\n        <a href="#contact" style="color:{{ linkColor }}; font-size:15px; font-weight:500; transition:color .3s;">{{ t.navContact }}</a>`,
  'desktop FAQ navigation'
);

template = replaceOnce(
  template,
  `<a href="#contact" onclick="{{ closeMenu }}" style="color:#0E2A63; font-size:17px; font-weight:600;">{{ t.navContact }}</a>`,
  `<a href="#faq" onclick="{{ closeMenu }}" style="color:#0E2A63; font-size:17px; font-weight:600;">{{ t.navFaq }}</a>\n      <a href="#contact" onclick="{{ closeMenu }}" style="color:#0E2A63; font-size:17px; font-weight:600;">{{ t.navContact }}</a>`,
  'mobile FAQ navigation'
);

template = replaceOnce(
  template,
  `<p style="font-size:16px; line-height:1.55; color:#556278; margin:0 0 28px; max-width:46ch;">{{ t.heroP }}</p>`,
  `<p style="font-size:19px; line-height:1.45; font-weight:600; color:#253B5D; margin:0 0 12px; max-width:48ch;">{{ t.heroLead }}</p>\n        <p style="font-size:16px; line-height:1.6; color:#556278; margin:0 0 28px; max-width:52ch;">{{ t.heroP }}</p>`,
  'split hero benefit and support copy'
);

template = replaceOnce(
  template,
  `</div>\n      </div>\n      <div>\n        <div style="position:relative; border-radius:24px; overflow:hidden; aspect-ratio:4/5; box-shadow:0 24px 60px rgba(14,42,99,0.16);">`,
  `</div>\n        <p style="display:flex; align-items:center; gap:8px; margin:16px 0 0; font-size:13.5px; font-weight:600; color:#3B475C;"><span style="width:8px; height:8px; border-radius:50%; background:#6DB33F;"></span>{{ t.heroConsistency }}</p>\n      </div>\n      <div>\n        <div style="position:relative; border-radius:24px; overflow:hidden; aspect-ratio:4/5; box-shadow:0 24px 60px rgba(14,42,99,0.16);">`,
  'hero consistency proof'
);

const visibleCopy = new Map([
  ['Bonded &amp; Insured', '{{ t.badgeBonded }}'],
  ['Trusted Cleaning Professionals', '{{ t.badgeTrusted }}'],
  ['Detailed Cleaning Checklist', '{{ t.badgeChecklist }}'],
  ['Consistent, Reliable Service', '{{ t.badgeReliable }}'],
  ['Fast quote, no obligation.', '{{ t.quickTitle }}'],
  ['How It Works', '{{ t.howKicker }}'],
  ['Getting Your Home Clean Should Be the Easy Part', '{{ t.howH2 }}'],
  ['Request Your Quote', '{{ t.how1Title }}'],
  ['Tell us about your home and what you need. We&rsquo;ll follow up quickly with a clear quote.', '{{ t.how1Desc }}'],
  ['Schedule Your Cleaning', '{{ t.how2Title }}'],
  ['Pick the day and frequency that fit your life. We handle the rest of the coordination.', '{{ t.how2Desc }}'],
  ['Enjoy Your Clean Home', '{{ t.how3Title }}'],
  ['Come home to a house that feels handled, without managing anything yourself.', '{{ t.how3Desc }}'],
  ['Recurring Cleaning', '{{ t.recKicker }}'],
  ['Imagine Not Having to Think About Cleaning Next Week', '{{ t.recH2 }}'],
  ['Less buildup. Less weekend cleaning. Less time managing household chores. More time enjoying your home.', '{{ t.recIntro }}'],
  ['Weekly Cleaning', '{{ t.weeklyTitle }}'],
  ['For busy homes that stay ahead of the mess with minimal effort.', '{{ t.weeklyDesc }}'],
  ['Least buildup between visits', '{{ t.weekly1 }}'],
  ['Ideal for larger families', '{{ t.weekly2 }}'],
  ['Highest consistency', '{{ t.weekly3 }}'],
  ['Most Popular', '{{ t.mostPopular }}'],
  ['Biweekly Cleaning', '{{ t.biweeklyTitle }}'],
  ['The rhythm most San Diego homeowners settle into.', '{{ t.biweeklyDesc }}'],
  ['Balanced upkeep', '{{ t.biweekly1 }}'],
  ['Great fit for most homes', '{{ t.biweekly2 }}'],
  ['Familiar professional each visit', '{{ t.biweekly3 }}'],
  ['Monthly Cleaning', '{{ t.monthlyTitle }}'],
  ['A regular reset for homes that stay tidy day to day.', '{{ t.monthlyDesc }}'],
  ['Monthly deep refresh', '{{ t.monthly1 }}'],
  ['Good for smaller homes', '{{ t.monthly2 }}'],
  ['Flexible scheduling', '{{ t.monthly3 }}'],
  ['Get a Recurring Cleaning Quote', '{{ t.recCta }}'],
  ['Who We Serve', '{{ t.whoKicker }}'],
  ['Cleaning Built Around Real Life', '{{ t.whoH2 }}'],
  ['Busy Professionals', '{{ t.who1Title }}'],
  ['Reclaim your evenings and weekends.', '{{ t.who1Desc }}'],
  ['Families', '{{ t.who2Title }}'],
  ['A cleaner, calmer home for everyday life.', '{{ t.who2Desc }}'],
  ['Vacation Homeowners', '{{ t.who3Title }}'],
  ['Arrive to a home that&rsquo;s already ready.', '{{ t.who3Desc }}'],
  ['Short-Term Rental Owners', '{{ t.who4Title }}'],
  ['Consistent, guest-ready turnovers.', '{{ t.who4Desc }}'],
  ['Realtors &amp; Property Owners', '{{ t.who5Title }}'],
  ['Showing-ready properties on schedule.', '{{ t.who5Desc }}'],
  ['Questions San Diego Homeowners Ask Us', '{{ t.faqH2 }}'],
  ['How much does house cleaning cost in San Diego?', '{{ t.faq1Q }}'],
  [`Pricing depends on the size of your home, the type of cleaning and how often you'd like service. Send us a few details about your home and we'll put together a free, personalized quote.`, '{{ t.faq1A }}'],
  ['Do you offer recurring cleaning?', '{{ t.faq2Q }}'],
  ['Yes. We offer weekly, biweekly and monthly recurring cleaning, and we work to keep your schedule and your cleaning professional consistent.', '{{ t.faq2A }}'],
  ['Do I need to be home during the cleaning?', '{{ t.faq3Q }}'],
  [`It's entirely up to you. Many clients are home, and many arrange access so they can go about their day. We'll confirm the arrangement that works for you.`, '{{ t.faq3A }}'],
  ['Do you bring cleaning supplies?', '{{ t.faq4Q }}'],
  ['Yes, our professionals arrive with the supplies and equipment needed for your service. If you prefer specific products for your home, just let us know.', '{{ t.faq4A }}'],
  ['Are you insured?', '{{ t.faq5Q }}'],
  ['Yes. EZClean Pros is bonded and insured.', '{{ t.faq5A }}'],
  ['Do you offer deep cleaning?', '{{ t.faq6Q }}'],
  [`Yes. Deep cleaning is a more detailed, top-to-bottom service, and it's a great starting point before beginning recurring cleaning.`, '{{ t.faq6A }}'],
  ['Do you offer move-out cleaning?', '{{ t.faq7Q }}'],
  ['Yes. We provide move-in and move-out cleaning for homes, condos and rentals.', '{{ t.faq7A }}'],
  ['Can I request the same cleaning professional?', '{{ t.faq8Q }}'],
  ['Whenever possible, we prioritize consistency in who services your home, so your professional gets familiar with your preferences.', '{{ t.faq8A }}'],
  ['Your Home Can Be Clean Without Cleaning Taking Over Your Life', '{{ t.finalH2 }}'],
  ['Spend less time worrying about the house. Spend more time enjoying it.', '{{ t.finalP }}'],
]);

const recurringBullets = new Set([
  'Least buildup between visits', 'Ideal for larger families', 'Highest consistency',
  'Balanced upkeep', 'Great fit for most homes', 'Familiar professional each visit',
  'Monthly deep refresh', 'Good for smaller homes', 'Flexible scheduling',
]);

for (const [before, after] of visibleCopy) {
  if (before === 'Get a Recurring Cleaning Quote') {
    template = replaceAllRequired(template, `>${before} &#8594;<`, `>${after} &#8594;<`, 3, `visible copy: ${before}`);
  } else if (recurringBullets.has(before)) {
    template = replaceAllRequired(template, `&#10003; ${before}<`, `&#10003; ${after}<`, 1, `visible copy: ${before}`);
  } else {
    template = replaceAllRequired(template, `>${before}<`, `>${after}<`, 1, `visible copy: ${before}`);
  }
}

template = replaceOnce(
  template,
  `<div style="font-size:13px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#1E5FD0; margin-bottom:16px;">FAQ</div>`,
  `<div style="font-size:13px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#1E5FD0; margin-bottom:16px;">{{ t.faqKicker }}</div>`,
  'localized FAQ kicker'
);

template = replaceOnce(
  template,
  `<h2 class="ez-section-h2" style="font-family:'Hanken Grotesk',sans-serif; font-weight:600; line-height:1.08; letter-spacing:-0.01em; color:#0E1E38; margin:0 0 34px;">{{ t.whyH2 }}</h2>`,
  `<h2 class="ez-section-h2" style="font-family:'Hanken Grotesk',sans-serif; font-weight:600; line-height:1.08; letter-spacing:-0.01em; color:#0E1E38; margin:0 0 14px;">{{ t.whyH2 }}</h2>\n          <p style="font-size:16px; line-height:1.6; color:#556278; margin:0 0 30px;">{{ t.whyIntro }}</p>`,
  'why section lead-in'
);

const localeFields = {
  en: {
    navFaq: 'FAQ',
    heroLead: 'A cleaner home without the stress of wondering who will show up or whether the job will be done right.',
    heroConsistency: 'The same trusted professional, whenever possible.',
    badgeBonded: 'Bonded & Insured', badgeTrusted: 'Trusted Cleaning Professionals', badgeChecklist: 'Detailed Cleaning Checklist', badgeReliable: 'Consistent, Reliable Service',
    quickTitle: 'Fast quote, no obligation.',
    howKicker: 'How It Works', howH2: 'Getting Your Home Clean Should Be the Easy Part',
    how1Title: 'Request Your Quote', how1Desc: "Tell us about your home and what you need. We’ll follow up quickly with a clear quote.",
    how2Title: 'Schedule Your Cleaning', how2Desc: 'Pick the day and frequency that fit your life. We handle the rest of the coordination.',
    how3Title: 'Enjoy Your Clean Home', how3Desc: 'Come home to a house that feels handled — without managing anything yourself.',
    recKicker: 'Recurring Cleaning', recH2: 'Imagine Not Having to Think About Cleaning Next Week', recIntro: 'Less buildup. Less weekend cleaning. Less time managing household chores. More time enjoying your home.',
    weeklyTitle: 'Weekly Cleaning', weeklyDesc: 'For busy homes that stay ahead of the mess with minimal effort.', weekly1: 'Least buildup between visits', weekly2: 'Ideal for larger families', weekly3: 'Highest consistency',
    mostPopular: 'Most Popular', biweeklyTitle: 'Biweekly Cleaning', biweeklyDesc: 'The rhythm most San Diego homeowners settle into.', biweekly1: 'Balanced upkeep', biweekly2: 'Great fit for most homes', biweekly3: 'Familiar professional each visit',
    monthlyTitle: 'Monthly Cleaning', monthlyDesc: 'A regular reset for homes that stay tidy day to day.', monthly1: 'Monthly deep refresh', monthly2: 'Good for smaller homes', monthly3: 'Flexible scheduling', recCta: 'Get a Recurring Cleaning Quote',
    whoKicker: 'Who We Serve', whoH2: 'Cleaning Built Around Real Life',
    who1Title: 'Busy Professionals', who1Desc: 'Reclaim your evenings and weekends.', who2Title: 'Families', who2Desc: 'A cleaner, calmer home for everyday life.', who3Title: 'Vacation Homeowners', who3Desc: 'Arrive to a home that’s already ready.', who4Title: 'Short-Term Rental Owners', who4Desc: 'Consistent, guest-ready turnovers.', who5Title: 'Realtors & Property Owners', who5Desc: 'Showing-ready properties on schedule.',
    faqKicker: 'FAQ', faqH2: 'Questions San Diego Homeowners Ask Us',
    faq1Q: 'How much does house cleaning cost in San Diego?', faq1A: 'Pricing depends on your home, the type of cleaning and how often you need service. Send us a few details and we’ll prepare a free, personalized quote.',
    faq2Q: 'Do you offer recurring cleaning?', faq2A: 'Yes. We offer weekly, biweekly and monthly cleaning, and we work to keep your schedule and cleaning professional consistent.',
    faq3Q: 'Do I need to be home during the cleaning?', faq3A: 'It’s entirely up to you. Many clients arrange access and go about their day. We’ll confirm what works for you.',
    faq4Q: 'Do you bring cleaning supplies?', faq4A: 'Yes. Our professionals arrive with the supplies and equipment needed. If you prefer specific products, just let us know.',
    faq5Q: 'Are you insured?', faq5A: 'Yes. EZClean Pros is bonded and insured.', faq6Q: 'Do you offer deep cleaning?', faq6A: 'Yes. Deep cleaning is a detailed, top-to-bottom service and a great starting point before recurring cleaning.', faq7Q: 'Do you offer move-out cleaning?', faq7A: 'Yes. We provide move-in and move-out cleaning for homes, condos and rentals.', faq8Q: 'Can I request the same cleaning professional?', faq8A: 'Whenever possible, we prioritize consistency so your professional gets familiar with your home and preferences.',
    finalH2: 'Your Home Can Be Clean Without Cleaning Taking Over Your Life', finalP: 'Spend less time worrying about the house. Spend more time enjoying it.',
    whyIntro: 'Professional cleaning should make your life easier — not give you another company to manage.',
  },
  es: {
    navFaq: 'Preguntas',
    heroLead: 'Una casa limpia sin el estrés de preguntarte quién llegará o si el trabajo quedará bien hecho.',
    heroConsistency: 'El mismo profesional de confianza, siempre que sea posible.',
    badgeBonded: 'Con Fianza y Seguro', badgeTrusted: 'Profesionales de Confianza', badgeChecklist: 'Checklist Detallada', badgeReliable: 'Servicio Constante y Confiable',
    quickTitle: 'Cotización rápida y sin compromiso.',
    howKicker: 'Cómo Funciona', howH2: 'Limpiar Tu Casa Debería Ser la Parte Fácil',
    how1Title: 'Solicita Tu Cotización', how1Desc: 'Cuéntanos sobre tu casa y lo que necesitas. Te responderemos pronto con una cotización clara.',
    how2Title: 'Agenda Tu Limpieza', how2Desc: 'Elige el día y la frecuencia que se adapten a tu vida. Nosotros coordinamos el resto.',
    how3Title: 'Disfruta Tu Casa Limpia', how3Desc: 'Vuelve a una casa impecable, sin tener que gestionar nada.',
    recKicker: 'Limpieza Recurrente', recH2: 'Imagina No Tener Que Pensar en la Limpieza la Próxima Semana', recIntro: 'Menos acumulación. Menos fines de semana limpiando. Menos tareas que coordinar. Más tiempo para disfrutar tu casa.',
    weeklyTitle: 'Limpieza Semanal', weeklyDesc: 'Para hogares ocupados que quieren adelantarse al desorden con el mínimo esfuerzo.', weekly1: 'Menos acumulación entre visitas', weekly2: 'Ideal para familias grandes', weekly3: 'Máxima constancia',
    mostPopular: 'Más Popular', biweeklyTitle: 'Limpieza Quincenal', biweeklyDesc: 'El ritmo que prefieren muchos propietarios de San Diego.', biweekly1: 'Mantenimiento equilibrado', biweekly2: 'Ideal para la mayoría de los hogares', biweekly3: 'Un profesional familiar en cada visita',
    monthlyTitle: 'Limpieza Mensual', monthlyDesc: 'Una puesta a punto regular para hogares que se mantienen ordenados a diario.', monthly1: 'Renovación profunda mensual', monthly2: 'Ideal para hogares pequeños', monthly3: 'Horarios flexibles', recCta: 'Cotizar Limpieza Recurrente',
    whoKicker: 'A Quién Atendemos', whoH2: 'Limpieza Pensada Para la Vida Real',
    who1Title: 'Profesionales Ocupados', who1Desc: 'Recupera tus tardes y fines de semana.', who2Title: 'Familias', who2Desc: 'Una casa más limpia y tranquila para el día a día.', who3Title: 'Propietarios de Casas Vacacionales', who3Desc: 'Llega a una casa que ya está lista.', who4Title: 'Anfitriones de Alquileres Cortos', who4Desc: 'Rotaciones constantes y listas para huéspedes.', who5Title: 'Agentes y Propietarios', who5Desc: 'Propiedades listas para mostrar a tiempo.',
    faqKicker: 'Preguntas Frecuentes', faqH2: 'Lo Que Preguntan los Propietarios de San Diego',
    faq1Q: '¿Cuánto cuesta la limpieza de una casa en San Diego?', faq1A: 'El precio depende de la vivienda, el tipo de limpieza y la frecuencia. Envíanos algunos datos y prepararemos una cotización gratuita y personalizada.',
    faq2Q: '¿Ofrecen limpieza recurrente?', faq2A: 'Sí. Ofrecemos limpieza semanal, quincenal y mensual, y procuramos mantener tu horario y profesional habituales.',
    faq3Q: '¿Necesito estar en casa durante la limpieza?', faq3A: 'Tú decides. Muchos clientes organizan el acceso y continúan con su día. Confirmaremos la opción que funcione para ti.',
    faq4Q: '¿Llevan los productos de limpieza?', faq4A: 'Sí. Nuestros profesionales llegan con los productos y equipos necesarios. Si prefieres productos específicos, avísanos.',
    faq5Q: '¿Tienen seguro?', faq5A: 'Sí. EZClean Pros cuenta con fianza y seguro.', faq6Q: '¿Ofrecen limpieza profunda?', faq6A: 'Sí. Es un servicio detallado de arriba a abajo y un gran punto de partida antes de una limpieza recurrente.', faq7Q: '¿Ofrecen limpieza de mudanza?', faq7A: 'Sí. Limpiamos casas, condominios y alquileres antes y después de una mudanza.', faq8Q: '¿Puedo solicitar al mismo profesional?', faq8A: 'Siempre que sea posible, priorizamos la constancia para que el profesional conozca tu casa y tus preferencias.',
    finalH2: 'Tu Casa Puede Estar Limpia Sin Que la Limpieza Se Apodere de Tu Vida', finalP: 'Dedica menos tiempo a preocuparte por la casa y más a disfrutarla.',
    whyIntro: 'La limpieza profesional debe hacerte la vida más fácil, no darte otra empresa que gestionar.',
  },
  pt: {
    navFaq: 'Dúvidas',
    heroLead: 'Uma casa limpa sem o estresse de se perguntar quem vai chegar ou se o serviço será bem-feito.',
    heroConsistency: 'O mesmo profissional de confiança, sempre que possível.',
    badgeBonded: 'Com Fiança e Seguro', badgeTrusted: 'Profissionais de Confiança', badgeChecklist: 'Checklist Detalhada', badgeReliable: 'Serviço Consistente e Confiável',
    quickTitle: 'Orçamento rápido e sem compromisso.',
    howKicker: 'Como Funciona', howH2: 'Deixar a Sua Casa Limpa Deveria Ser a Parte Fácil',
    how1Title: 'Peça Seu Orçamento', how1Desc: 'Conte como é a sua casa e do que você precisa. Retornamos rapidamente com um orçamento claro.',
    how2Title: 'Agende a Limpeza', how2Desc: 'Escolha o dia e a frequência que combinam com a sua rotina. A gente coordena o restante.',
    how3Title: 'Aproveite a Casa Limpa', how3Desc: 'Volte para uma casa em ordem, sem precisar gerenciar nada.',
    recKicker: 'Limpeza Recorrente', recH2: 'Imagine Não Precisar Pensar na Limpeza da Próxima Semana', recIntro: 'Menos acúmulo. Menos finais de semana limpando. Menos tarefas para gerenciar. Mais tempo para aproveitar a sua casa.',
    weeklyTitle: 'Limpeza Semanal', weeklyDesc: 'Para casas movimentadas que querem evitar o acúmulo com o mínimo de esforço.', weekly1: 'Menos acúmulo entre visitas', weekly2: 'Ideal para famílias maiores', weekly3: 'Máxima consistência',
    mostPopular: 'Mais Popular', biweeklyTitle: 'Limpeza Quinzenal', biweeklyDesc: 'O ritmo preferido de muitos moradores de San Diego.', biweekly1: 'Manutenção equilibrada', biweekly2: 'Ótima para a maioria das casas', biweekly3: 'Um profissional familiar a cada visita',
    monthlyTitle: 'Limpeza Mensal', monthlyDesc: 'Um reset regular para casas que se mantêm organizadas no dia a dia.', monthly1: 'Renovação profunda mensal', monthly2: 'Boa para casas menores', monthly3: 'Horários flexíveis', recCta: 'Pedir Orçamento Recorrente',
    whoKicker: 'Quem Atendemos', whoH2: 'Limpeza Pensada Para a Vida Real',
    who1Title: 'Profissionais Ocupados', who1Desc: 'Recupere suas noites e seus finais de semana.', who2Title: 'Famílias', who2Desc: 'Uma casa mais limpa e tranquila para o dia a dia.', who3Title: 'Donos de Casas de Temporada', who3Desc: 'Chegue a uma casa que já está pronta.', who4Title: 'Anfitriões de Aluguel por Temporada', who4Desc: 'Viradas consistentes e prontas para hóspedes.', who5Title: 'Corretores e Proprietários', who5Desc: 'Imóveis prontos para visita no prazo.',
    faqKicker: 'Dúvidas Frequentes', faqH2: 'O Que os Moradores de San Diego Perguntam',
    faq1Q: 'Quanto custa a limpeza residencial em San Diego?', faq1A: 'O preço depende da casa, do tipo de limpeza e da frequência. Envie alguns detalhes e preparamos um orçamento gratuito e personalizado.',
    faq2Q: 'Vocês oferecem limpeza recorrente?', faq2A: 'Sim. Oferecemos limpeza semanal, quinzenal e mensal e buscamos manter o seu horário e o mesmo profissional.',
    faq3Q: 'Preciso estar em casa durante a limpeza?', faq3A: 'Você decide. Muitos clientes combinam o acesso e seguem o dia normalmente. Confirmamos a opção que funcionar para você.',
    faq4Q: 'Vocês levam os produtos de limpeza?', faq4A: 'Sim. Nossos profissionais chegam com os produtos e equipamentos necessários. Se preferir produtos específicos, é só avisar.',
    faq5Q: 'A empresa tem seguro?', faq5A: 'Sim. A EZClean Pros tem fiança e seguro.', faq6Q: 'Vocês fazem limpeza pesada?', faq6A: 'Sim. É um serviço detalhado, de cima a baixo, e um ótimo começo antes da limpeza recorrente.', faq7Q: 'Vocês fazem limpeza de mudança?', faq7A: 'Sim. Fazemos limpeza de entrada e saída em casas, condomínios e imóveis alugados.', faq8Q: 'Posso pedir o mesmo profissional?', faq8A: 'Sempre que possível, priorizamos a consistência para que o profissional conheça a sua casa e as suas preferências.',
    finalH2: 'Sua Casa Pode Ficar Limpa Sem Que a Limpeza Tome Conta da Sua Vida', finalP: 'Passe menos tempo se preocupando com a casa e mais tempo aproveitando-a.',
    whyIntro: 'A limpeza profissional deve facilitar a sua vida, não criar mais uma empresa para você gerenciar.',
  },
};

function serializeField(value) {
  return JSON.stringify(value).replaceAll(' ', '\\u2028').replaceAll(' ', '\\u2029');
}

for (const [locale, fields] of Object.entries(localeFields)) {
  const localeStart = `      ${locale}: {`;
  const start = template.indexOf(localeStart);
  if (start === -1) throw new Error(`Could not locate ${locale} dictionary.`);
  const navEnd = template.indexOf('\n', start + localeStart.length);
  if (navEnd === -1) throw new Error(`Could not locate ${locale} dictionary insertion point.`);
  const lines = Object.entries(fields).map(([key, value]) => `        ${key}:${serializeField(value)},`).join('\n');
  template = template.slice(0, navEnd + 1) + lines + '\n' + template.slice(navEnd + 1);
}

const dictionaryReplacements = [
  [`heroP:'A cleaner home without the stress of wondering who will show up or whether the job will be done right. EZClean Pros provides reliable residential cleaning with trusted professionals, detailed service and the consistency your home deserves.'`, `heroP:'EZClean Pros provides reliable residential cleaning with trusted professionals, detailed service and the consistency your home deserves.'`],
  [`svcKicker:'What We Do', svcH2:'We handle homes and businesses.'`, `svcKicker:'Our Services', svcH2:'Professional Cleaning for the Way You Live'`],
  [`svcIntro:'Two different jobs, but the process doesn’t change: same checklist, no matter which one is yours.'`, `svcIntro:'Choose the service that fits your home, property, business and schedule.'`],
  [`whyKicker:'Why EZClean Pros', whyH2:"You Shouldn't Have to Manage Your Cleaning Company"`, `whyKicker:'Why EZClean Pros', whyH2:"You Shouldn’t Have to Manage Your Cleaning Company"`],
  [`arKicker:'Coverage', arH2:'All of San Diego County.'`, `arKicker:'Service Areas', arH2:'Proudly Serving San Diego and Surrounding Communities'`],
  [`heroP:'Casas y oficinas en todo el condado de San Diego, con la misma disciplina y la misma checklist: con fianza, asegurados y con un solo limpiador que conoce tu espacio.'`, `heroP:'EZClean Pros ofrece limpieza residencial confiable, profesionales de confianza, servicio detallado y la constancia que tu hogar merece.'`],
  [`heroH1:'Limpieza Residencial y Comercial en San Diego, Guiada por Checklists.'`, `heroH1:'Limpieza Residencial en San Diego en la Que Puedes Confiar'`],
  [`heroEyebrow:'Servicio en todo San Diego'`, `heroEyebrow:'Limpieza residencial local • San Diego, CA'`],
  [`svcKicker:'Lo Que Hacemos', svcH2:'Atendemos casas y empresas.'`, `svcKicker:'Nuestros Servicios', svcH2:'Limpieza Profesional Para Tu Estilo de Vida'`],
  [`svcIntro:'Dos frentes distintos, pero la forma de trabajar es siempre la misma: la misma checklist, sin importar cuál sea tu caso.'`, `svcIntro:'Elige el servicio que se adapte a tu hogar, propiedad, negocio y horario.'`],
  [`clKicker:'Cada Visita, Verificada', clH2:'La checklist de salida.'`, `clKicker:'Nuestro Proceso', clH2:'No Solo Decimos Que Cuidamos los Detalles. Seguimos un Proceso.'`],
  [`clIntro:'Cada visita de EZClean Pros se cierra con la misma lista, sin importar quién limpie. Nada se marca como hecho de memoria.'`, `clIntro:'Una visita sale perfecta y en la siguiente se olvida algo. Nuestro proceso está pensado para reducir ese problema.'`],
  [`whyKicker:'Por Qué EZClean Pros', whyH2:'Por lo que realmente pagas.'`, `whyKicker:'Por Qué EZClean Pros', whyH2:'No Deberías Tener Que Gestionar a Tu Empresa de Limpieza'`],
  [`rvKicker:'Lo Que Dicen Los Clientes', rvH2:'Reseñas de casas y oficinas en San Diego.'`, `rvKicker:'Reseñas', rvH2:'Lo Que Dicen los Propietarios de San Diego'`],
  [`ftDesc:'Con base en San Diego, trabajando a diario en la costa y el interior. Sin call center de franquicia en otro estado.'`, `ftDesc:'Limpieza residencial confiable en San Diego, CA. Con fianza y seguro.'`],
  [`arKicker:'Cobertura', arH2:'Todo el condado de San Diego.'`, `arKicker:'Zonas de Servicio', arH2:'Con Orgullo Atendemos San Diego y Sus Alrededores'`],
  [`heroP:'Casas e escritórios em todo o condado de San Diego, com a mesma disciplina e a mesma checklist: com fiança, segurados e com um único profissional que conhece o seu espaço.'`, `heroP:'A EZClean Pros oferece limpeza residencial confiável, profissionais de confiança, serviço detalhado e a consistência que a sua casa merece.'`],
  [`heroH1:'Limpeza Residencial e Comercial em San Diego, Guiada por Checklists.'`, `heroH1:'Limpeza Residencial em San Diego em Que Você Pode Confiar'`],
  [`heroEyebrow:'Atendendo toda a Grande San Diego'`, `heroEyebrow:'Limpeza residencial local • San Diego, CA'`],
  [`svcKicker:'O Que Fazemos', svcH2:'Atendemos residências e empresas.'`, `svcKicker:'Nossos Serviços', svcH2:'Limpeza Profissional Para o Seu Estilo de Vida'`],
  [`svcIntro:'Duas frentes diferentes, mas o jeito de trabalhar é sempre o mesmo: a mesma checklist, não importa qual dos dois for o seu caso.'`, `svcIntro:'Escolha o serviço que combina com a sua casa, imóvel, empresa e rotina.'`],
  [`clKicker:'Cada Visita, Verificada', clH2:'A checklist de saída.'`, `clKicker:'Nosso Processo', clH2:'Não Basta Dizer Que Cuidamos dos Detalhes. Seguimos um Processo.'`],
  [`clIntro:'Cada visita da EZClean Pros é fechada com a mesma lista, não importa quem esteja no local. Nada é marcado como feito de memória.'`, `clIntro:'Uma visita fica ótima e, na seguinte, alguma coisa é esquecida. Nosso processo foi criado para reduzir esse problema.'`],
  [`whyKicker:'Por Que a EZClean Pros', whyH2:'Pelo que você realmente paga.'`, `whyKicker:'Por Que a EZClean Pros', whyH2:'Você Não Deveria Precisar Gerenciar a Sua Empresa de Limpeza'`],
  [`rvKicker:'O Que Dizem os Clientes', rvH2:'Avaliações de casas e escritórios em San Diego.'`, `rvKicker:'Avaliações', rvH2:'O Que os Moradores de San Diego Dizem'`],
  [`ftDesc:'Com base em San Diego, atuando diariamente no litoral e no interior. Sem call center de franquia em outro estado.'`, `ftDesc:'Limpeza residencial confiável em San Diego, CA. Com fiança e seguro.'`],
  [`arKicker:'Cobertura', arH2:'Todo o condado de San Diego.'`, `arKicker:'Regiões Atendidas', arH2:'Atendemos San Diego e as Comunidades Próximas'`],
];

for (const [before, after] of dictionaryReplacements) {
  template = replaceOnce(template, before, after, `dictionary copy: ${before}`);
}

const reasonReplacements = [
  [`{ num:'1', title:'Reagenda sin complicaciones', desc:'La vida pasa. Cambia, salta o agrega una limpieza con un mensaje o un clic — sin cargos por cancelación, sin vueltas por teléfono.' }`, `{ num:'1', title:'Un Profesional Que Conoce Tu Casa', desc:'Siempre que sea posible, mantenemos al mismo profesional. Menos explicaciones, más familiaridad con tus preferencias y atención a lo que te importa.' }`],
  [`{ num:'2', title:'Con fianza y asegurados', desc:'Cada integrante es verificado, con fianza y asegurado antes de entrar a tu espacio. No es marketing, es un requisito.' }`, `{ num:'2', title:'Limpieza Detallada, Sin Improvisar', desc:'Cada visita sigue una checklist por habitación para atender los detalles de la misma manera, cada vez.' }`],
  [`{ num:'3', title:'La misma checklist, siempre', desc:'Cada visita se cierra con el mismo estándar, ya sea tu primera limpieza o la número cincuenta.' }`, `{ num:'3', title:'Con Fianza y Seguro', desc:'Tu casa queda al cuidado de profesionales con quienes puedes sentirte cómodo.' }`],
  [`{ num:'4', title:'Locales en San Diego', desc:'Con base en San Diego, trabajando a diario en la costa y el interior. Sin call center de franquicia en otro estado.' }`, `{ num:'4', title:'Comunicación Confiable', desc:'Horarios claros, respuestas directas y seguimiento sencillo cuando algo cambia.' }`],
  [`{ num:'1', title:'Reagende sem complicação', desc:'A vida acontece. Mude, pule ou adicione uma limpeza com uma mensagem ou um clique — sem taxa de cancelamento, sem enrolação no telefone.' }`, `{ num:'1', title:'Um Profissional Que Conhece a Sua Casa', desc:'Sempre que possível, mantemos o mesmo profissional. Menos explicações, mais familiaridade com as suas preferências e atenção ao que importa para você.' }`],
  [`{ num:'2', title:'Com fiança e segurados', desc:'Cada integrante é verificado, com fiança e segurado antes de entrar no seu espaço. Não é marketing, é uma exigência.' }`, `{ num:'2', title:'Limpeza Detalhada, Sem Achismos', desc:'Cada visita segue uma checklist por cômodo para cuidar dos detalhes do mesmo jeito, sempre.' }`],
  [`{ num:'3', title:'A mesma checklist, sempre', desc:'Cada visita é fechada com o mesmo padrão, seja a primeira limpeza ou a quinquagésima.' }`, `{ num:'3', title:'Com Fiança e Seguro', desc:'A sua casa fica aos cuidados de profissionais com quem você pode se sentir à vontade.' }`],
  [`{ num:'4', title:'Locais em San Diego', desc:'Com base em San Diego, atuando diariamente no litoral e no interior. Sem call center de franquia em outro estado.' }`, `{ num:'4', title:'Comunicação Confiável', desc:'Agenda clara, respostas diretas e acompanhamento simples quando alguma coisa muda.' }`],
];

for (const [before, after] of reasonReplacements) {
  template = replaceOnce(template, before, after, `localized reason: ${before}`);
}

template = template.replace('alt="EZClean Pros team cleaning a commercial office"', 'alt="EZClean Pros cleaning professional at work in San Diego"');

const forbiddenVisibleEnglish = [
  '>Fast quote, no obligation.<', '>How It Works<', '>Weekly Cleaning<',
  '>Who We Serve<', '>Questions San Diego Homeowners Ask Us<',
  '>Your Home Can Be Clean Without Cleaning Taking Over Your Life<',
];

for (const phrase of forbiddenVisibleEnglish) {
  if (template.includes(phrase)) throw new Error(`Hard-coded English remains: ${phrase}`);
}

let output = source;
output = replaceAllRequired(output, titleV4, titleV5, 6, 'bundled SEO title');
output = replaceAllRequired(output, descriptionV4, descriptionV5, 7, 'bundled SEO description');

const encodedTemplate = JSON.stringify(template).replaceAll('</', '<\\u002F');
output = output.replace(
  /(<script type="__bundler\/template">)[\s\S]*?(<\/script>)/,
  (_match, openTag, closeTag) => openTag + encodedTemplate + closeTag,
);

fs.writeFileSync(outputPath, output, 'utf8');

console.log(`Built ${path.relative(process.cwd(), outputPath)}`);
console.log(`Source: ${path.relative(process.cwd(), sourcePath)}`);
console.log(`Size: ${(Buffer.byteLength(output) / 1024).toFixed(0)} KB`);
