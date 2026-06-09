export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900 font-sans">

      {/* NAV */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-gray-100">
        <div className="text-xl font-semibold tracking-tight">
          Ai<span className="text-emerald-600">QMS</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#funktioner" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Funktioner</a>
          <a href="#priser" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Priser</a>
          <a href="/login" className="text-sm px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Log ind
          </a>
          <a href="/login" className="text-sm px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors">
            Prøv gratis
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section className="max-w-4xl mx-auto px-8 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-4 py-1.5 text-xs text-gray-500 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Bygget til IFS · BRC · FSSC 22000 · ISO 22000
        </div>
        <h1 className="text-5xl font-semibold tracking-tight text-gray-900 leading-tight mb-6">
          Det QMS der aldrig sover —<br />
          <span className="text-emerald-600">og altid er klar til audit</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          AiQMS er det første AI-drevne kvalitetsstyringssystem bygget specifikt til
          fødevareproducenter på engros-niveau. Ingen kurser. Ingen papir. Altid audit-ready.
        </p>
        <div className="flex items-center justify-center gap-4">
          <a href="/login" className="px-6 py-3 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors">
            Start 30 dages gratis prøve
          </a>
          <button className="px-6 py-3 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
            Se en demo →
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-4">Ingen kreditkort krævet · Opsætning på under 2 timer</p>
      </section>

      {/* PAIN POINTS */}
      <section className="bg-gray-50 py-12 px-8">
        <p className="text-center text-xs text-gray-400 uppercase tracking-widest mb-8">Kender du det her?</p>
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: "📊", title: "Excel-kaos", desc: "Ingen versionshistorik. Ingen sporbarhed. Ingen overblik." },
            { icon: "😤", title: "D4 er for komplekst", desc: "Kræver kurser bare for at navigere. Brugt af få — forstået af færre." },
            { icon: "📅", title: "Audit = panik", desc: "Dage brugt på at samle dokumentation. Hvert eneste gang." },
            { icon: "🏭", title: "Multi-site-rod", desc: "Eksternt lager kører sit eget system. Ingen kobling." },
          ].map((item) => (
            <div key={item.title} className="bg-white border border-gray-100 rounded-xl p-5">
              <div className="text-2xl mb-3">{item.icon}</div>
              <h3 className="text-sm font-semibold text-gray-800 mb-1">{item.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="funktioner" className="max-w-4xl mx-auto px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold tracking-tight text-gray-900 mb-3">
            Alt hvad dit QA-system skal kunne
          </h2>
          <p className="text-gray-500">Seks moduler der taler sammen — og en AI der aldrig holder fri</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { num: "01", title: "Flowdiagrammer", desc: "Byg procesflows visuelt. Fundamentet for hele din HACCP-analyse." },
            { num: "02", title: "Risikoanalyse", desc: "Fareanalyse og CCP-identifikation kobles direkte til dine flows." },
            { num: "03", title: "Dokumentstyring", desc: "SOP'er og arbejdsinstruktioner med fuld versionshistorik." },
            { num: "04", title: "Afvigelser & CAPA", desc: "Fra opdagelse til korrektion — AI foreslår rodårsagen." },
            { num: "05", title: "Management Review", desc: "AI genererer ledelsesgennemgangen automatisk. Klar på minutter." },
            { num: "06", title: "AI Audit-assistent", desc: "Real-time audit-score. Gap-analyse. Altid forberedt." },
          ].map((f) => (
            <div key={f.num} className="border border-gray-100 rounded-xl p-6 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all">
              <div className="text-xs font-medium text-emerald-600 mb-3 tracking-wider">{f.num}</div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">{f.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AI SECTION */}
      <section className="bg-slate-800 text-white py-16 px-8">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-xs text-emerald-400 uppercase tracking-widest mb-4">Kollektiv intelligens</div>
            <h2 className="text-3xl font-semibold tracking-tight mb-4">
              AI der lærer af hele branchen
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              AiQMS er det eneste QMS med kollektiv intelligens. Anonymiseret viden fra hundredvis
              af fødevareproducenter hjælper dig med at spotte risici du ikke vidste eksisterede.
            </p>
            <ul className="space-y-2">
              {[
                "Foreslår farepunkter baseret på dit specifikke procesflow",
                "Advarer om mønstre der typisk giver bemærkninger ved audit",
                "Benchmarker din CAPA-performance mod branchen",
                "Du bestemmer om du vil bidrage til den kollektive viden",
              ].map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0"></span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-slate-700 rounded-xl p-5 border border-slate-600">
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-600">
              <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
              <span className="text-sm font-medium">AI Audit-assistent</span>
            </div>
            <div className="bg-slate-600 rounded-lg p-3 mb-3 text-xs text-slate-200 leading-relaxed">
              Jeres pasteuriseringsflow mangler et dokumenteret CCP ved trin 4.
              IFS-auditorer markerer typisk dette.
            </div>
            <div className="bg-emerald-900/50 border border-emerald-700/50 rounded-lg p-3 text-xs text-emerald-200 leading-relaxed">
              Jeg har fundet 2 lignende flows i systemet. Den mest effektive løsning
              var at tilføje en temperaturlog ved 72°C i 15 sek. Vil du oprette en CAPA?
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="priser" className="max-w-4xl mx-auto px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold tracking-tight text-gray-900 mb-3">
            Gennemsigtige priser
          </h2>
          <p className="text-gray-500">Vælg den tier der passer til din virksomhed. Ingen skjulte gebyrer.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              name: "Starter", price: "799", desc: "1-10 ansatte · 1 site", featured: false,
              features: ["Op til 5 flowdiagrammer", "3 brugere", "Alle 6 moduler", "AI Audit-assistent"],
            },
            {
              name: "Growth", price: "1.999", desc: "11-50 ansatte · 3 sites", featured: true,
              features: ["Op til 20 flowdiagrammer", "10 brugere", "1 eksternt lager", "Fuld AI-integration"],
            },
            {
              name: "Pro", price: "4.499", desc: "50+ ansatte · multi-site", featured: false,
              features: ["Ubegrænset flows", "Ubegrænset brugere", "Ubegrænset sites & lagre", "AI API-adgang"],
            },
          ].map((tier) => (
            <div
              key={tier.name}
              className={`rounded-xl p-6 border ${tier.featured
                ? "border-emerald-500 bg-emerald-50"
                : "border-gray-100 bg-white"}`}
            >
              {tier.featured && (
                <div className="inline-block bg-emerald-100 text-emerald-700 text-xs px-3 py-1 rounded-full mb-3">
                  Mest populær
                </div>
              )}
              <div className="text-base font-semibold text-gray-800 mb-1">{tier.name}</div>
              <div className="text-3xl font-semibold tracking-tight text-gray-900 mb-1">
                {tier.price}<span className="text-sm font-normal text-gray-500"> kr/md</span>
              </div>
              <div className="text-xs text-gray-400 mb-5">{tier.desc}</div>
              <ul className="space-y-2 mb-6">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="text-emerald-500">✓</span> {f}
                  </li>
                ))}
              </ul>
              <a href="/login" className={`block text-center w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${tier.featured
                ? "bg-slate-800 text-white hover:bg-slate-700"
                : "border border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
                Kom i gang
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-100 py-16 px-8 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-gray-900 mb-3">
          Klar til dit første audit-ready QMS?
        </h2>
        <p className="text-gray-500 mb-8">30 dages gratis prøve. Opsætning på under 2 timer. Ingen kreditkort.</p>
        <a href="/login" className="px-8 py-3 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors">
          Kom i gang gratis
        </a>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-100 px-8 py-6 flex items-center justify-between">
        <div className="text-sm font-semibold">
          Ai<span className="text-emerald-600">QMS</span>
        </div>
        <p className="text-xs text-gray-400">© 2026 AiQMS · Alle rettigheder forbeholdes</p>
      </footer>

    </main>
  );
}