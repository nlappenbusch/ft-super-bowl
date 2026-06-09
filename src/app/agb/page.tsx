import type { Metadata } from 'next';
import LegalPage, { LegalH2, LegalH3 } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Allgemeine Geschäftsbedingungen (AGB) | Faltin Travel AG',
  description: 'Allgemeine Reise- und Vertragsbedingungen der Faltin Travel AG, Regensdorf. Stand: Dezember 2023.',
  alternates: { canonical: '/agb' },
};

const toc = [
  '01. Allgemeine Reise- und Vertragsbedingungen',
  '02. Abschluss des Reisevertrages',
  '03. Preise und Zahlungsbedingungen',
  '04. Annullierung / Änderung der Reise',
  '05. Beanstandungen / Ersatzansprüche',
  '06. Abbruch, Nichtdurchführung, Programmänderung',
  '07. Vorzeitiger Abbruch oder Änderungen während der Reise durch den Kunden',
  '08. Pass, Visa, Impfungen',
  '09. Haftung',
  '10. Flüge',
  '11. Sportmöglichkeiten',
  '12. Datenschutz',
  '13. Anwendbares Recht und Gerichtsstand',
  '14. Versicherung',
];

export default function AGBPage() {
  return (
    <LegalPage
      title="Allgemeine Geschäftsbedingungen"
      subtitle="Allgemeine Reise- und Vertragsbedingungen der Faltin Travel AG, Regensdorf. Stand: Dezember 2023."
      breadcrumb={[
        { name: 'Start', href: '/' },
        { name: 'AGB', href: '/agb' },
      ]}
    >
      {/* Inhaltsverzeichnis */}
      <div className="rounded-xl p-5" style={{ background: '#f3f7fc', border: '1px solid #e5e8ed' }}>
        <p className="mb-3 font-bold" style={{ color: '#143047' }}>Inhaltsverzeichnis</p>
        <ul className="grid gap-1.5 text-sm md:grid-cols-2">
          {toc.map((t, i) => (
            <li key={t}>
              <a href={`#agb-${String(i + 1).padStart(2, '0')}`} className="text-[#18395a] hover:underline">{t}</a>
            </li>
          ))}
        </ul>
      </div>

      <LegalH2 id="agb-01">1. Allgemeine Reise- und Vertragsbedingungen</LegalH2>
      <p>
        Wir freuen uns, dass Sie sich für eine Reise mit Faltin Travel AG, mit Sitz in Regensdorf (nachfolgend
        „Faltin-Travel" genannt) interessieren und danken für Ihr Vertrauen.
      </p>
      <p>
        Die nachfolgenden Allgemeinen Reise- und Vertragsbedingungen gelten für alle Reiseteilnehmer/innen und regeln die
        Rechtsbeziehung zwischen Ihnen als Kunden und uns als Reiseveranstalter. Die nachfolgenden Allgemeinen Reise- und
        Vertragsbedingungen sind Bestandteil des Vertrages zwischen Ihnen und Faltin-Travel. Mit der Buchung erklären Sie
        sich mit den vorliegenden Reise- und Vertragsbedingungen einverstanden. Die jeweils aktuelle Fassung dieser Reise-
        und Vertragsbedingungen wird auch auf faltintravel.com veröffentlicht. Abweichungen von diesen Reise- und
        Vertragsbedingungen gelten nur, soweit Faltin-Travel ausdrücklich und schriftlich zugestimmt hat.
      </p>

      <LegalH2 id="agb-02">2. Abschluss des Reisevertrages</LegalH2>
      <p>
        2.1 Der Vertrag zwischen Ihnen und Faltin-Travel kommt mit der Entgegennahme Ihrer persönlichen, schriftlichen oder
        telefonischen Buchung zustande. Bei schriftlichen Buchungen, per Fax, E-Mail, SMS oder über unsere Webseite,
        erhalten Sie eine schriftliche Annahme Ihrer Anmeldung. Sowohl bei telefonischer oder persönlicher wie aber auch bei
        schriftlicher Buchung bestätigt Ihnen Faltin-Travel Ihre Buchung durch schriftliche Zusammenstellung des gebuchten
        Reisearrangements (nachfolgend „Buchungsbestätigung" genannt). Faltin-Travel handelt in allen anderen Fällen
        lediglich als Vermittler von Leistungen Dritter (siehe 2.2). Sollten Sie weitere Reiseteilnehmer/innen anmelden, so
        haben Sie für deren Vertragspflichten (insbesondere für die Bezahlung des Reisepreises) wie für Ihre eigenen
        Verpflichtungen einzustehen.
      </p>
      <p>
        2.2 Vermitteln Ihnen Drittanbieter oder andere Reiseveranstalter einzelne Reisenebenleistungen (z.B. Hotel,
        Eintrittskarten etc.) oder Reisearrangements, so gelten deren eigene Reise- und Vertragsbedingungen. Vermittelt
        Faltin-Travel Nur-Flug-Arrangements mit Linienflügen, so gelten die allgemeinen Vertrags- und Reisebedingungen der
        zuständigen Airline. Faltin-Travel ist in all diesen Fällen nicht Vertragspartei, Sie können sich daher auch nicht
        auf die vorliegenden Reise- und Vertragsbedingungen berufen. Allfällige Verweise hiernach dienen einzig der
        Information der Reiseteilnehmer/innen. Der Vertrag zwischen dem Kunden einerseits und Faltin-Travel (als Vermittler)
        und der Airline andererseits kommt erst mit der Ticketausstellung zustande. Änderungen seitens der Airline gehen bis
        zur Ticketausstellung zu Lasten des Kunden.
      </p>
      <p>
        2.3 Bei der Buchung sind Sie verpflichtet, Ihren Namen und die Namen der Mitreisenden wie in den für die Reise
        verwendeten Personalausweisen (Pass, usw.) anzugeben. Stimmen die Namen auf den Reisedokumenten/Flugschein nicht mit
        den Namen auf dem Personalausweis überein, so kann Ihnen die Reiseleistung, z.B. durch die Airline, verweigert
        werden oder es entstehen Kosten für die Neuausstellung des Tickets. In diesem Falle werden nicht bezogene Leistungen
        nicht erstattet.
      </p>
      <p>
        2.4 Bitte beachten Sie, dass das rechtzeitige Eintreffen am Abreiseort in Ihrer Verantwortung liegt. Dies gilt auch
        dann, wenn Ihnen die Buchungsstelle ausserhalb unseres Programms die Anreise organisiert.
      </p>

      <LegalH2 id="agb-03">3. Preise und Zahlungsbedingungen</LegalH2>
      <p>
        3.1 Die von Faltin-Travel in Prospekten oder auf der Homepage angegebenen Preise gelten als unverbindliche
        Preisempfehlung. Faltin-Travel behält sich die jederzeitige Anpassung der veröffentlichten Preise vor. Für den
        Kunden gelten die im Zeitpunkt der Buchung gültigen und auf der Buchungsbestätigung ausgewiesenen Preise. Wenn nicht
        explizit anders angegeben, verstehen sich die Preise pro Person in Schweizer Franken mit Unterkunft in
        Doppelzimmern bei Zweierbelegung. Alle Preise verstehen sich inklusive der gesetzlichen Mehrwertsteuer und sind
        Barzahlungspreise. Zahlen Sie mit Kreditkarte, kann die Buchungsstelle einen angemessenen Zuschlag erheben. Bei
        Baukastenarrangements sind die Preise aufenthaltsbezogen (oder gemäss Ausschreibung).
      </p>
      <LegalH3>3.2 Zahlungsbedingungen</LegalH3>
      <div className="rounded-xl p-4" style={{ background: '#f3f7fc', border: '1px solid #e5e8ed' }}>
        <p className="font-semibold" style={{ color: '#143047' }}>3.2.1 Anzahlung</p>
        <p className="mt-1">
          Bei Buchung ist gleichzeitig eine Anzahlung von 30% des vereinbarten Reisepreises zu leisten. Bei Buchungen
          weniger als 45 Tage vor Abreise, bei Buchungen von „Nur Eintrittskarten" oder Linienflugtickets oder
          Pauschalreisen (Arrangements), die Eintrittskarten oder Flugtickets beinhalten, ist der gesamte Rechnungsbetrag zu
          bezahlen.
        </p>
        <p className="mt-3 font-semibold" style={{ color: '#143047' }}>3.2.2 Restzahlung</p>
        <p className="mt-1">
          Die Restzahlung ist 45 Tage vor Reiseantritt fällig. Die Reisedokumente werden nach Zahlungseingang über den
          kompletten Rechnungsbetrag ca. 14 Tage vor Reiseantritt zugestellt, sofern nichts anderes vereinbart wurde. Nicht
          rechtzeitige Zahlung berechtigt uns, die Reiseleistungen zu verweigern.
        </p>
      </div>
      <LegalH3>3.3 Preisänderungen</LegalH3>
      <p>
        3.3.1 Für die nachfolgend aufgeführten Fälle behalten wir uns vor, den in der Buchungsbestätigung angegebenen
        Reisepreis zu erhöhen, im Falle von: plausibel erklärbaren Druckfehlern; Tarifänderungen von Transportunternehmen
        (z.B. Treibstoffzuschlägen); neu eingeführten oder erhöhten allgemein verbindlichen Gebühren oder Abgaben (z.B.
        erhöhte Flughafentaxen); Wechselkursänderungen; staatlich verfügten Preiserhöhungen (z.B. Mehrwertsteuer);
        ausserordentlichen Preiserhöhungen von Hotels.
      </p>
      <p>
        3.3.2 Falls Faltin-Travel den angegebenen Reisepreis aus den oben erwähnten Gründen ändern muss, wird Ihnen diese
        Preiserhöhung bis spätestens 3 Wochen vor Abreise bekanntgegeben. Beträgt die Preiserhöhung mehr als 10% des
        ursprünglich gebuchten Reisepreises, so haben Sie das Recht, innerhalb von 5 Tagen nach Erhalt unserer Mitteilung
        kostenlos vom Vertrag zurückzutreten. Sollte dies der Fall sein, so wird Ihnen Faltin-Travel alle von Ihnen bereits
        geleisteten Zahlungen schnellstmöglich zurückerstatten.
      </p>

      <LegalH2 id="agb-04">4. Annullierung / Änderung der Reise</LegalH2>
      <p>
        4.1 Eine Annullierung/Änderung einer bereits gebuchten Reise muss grundsätzlich schriftlich erfolgen. Die
        Reisehinweise des EDA und/oder des BAG werden von Faltin-Travel beachtet und eingehalten. Raten diese Bundesstellen
        vor Reisen in ein von Ihnen gebuchtes Land resp. Region ab, so können Sie Ihre Buchung während einer bestimmten
        Periode kostenlos ändern. Es werden keine Annullierungsgebühren fällig, jedoch können Bearbeitungsgebühren gemäss
        Ziffer 4.2, Versicherungsprämien und evtl. Visaspesen verlangt werden. Wird vom EDA oder vom BAG nicht ausdrücklich
        vor Reisen in Ihr gebuchtes Land resp. Region abgeraten, so gelten die nachfolgenden Bedingungen.
      </p>
      <p>
        4.2 <strong>Bearbeitungsgebühren:</strong> Bis zu Beginn der Annullierungsfristen (siehe 4.3) erheben wir für
        Annullierungen und Änderungen (Namensänderungen, Änderungen des Reisedatums, Umbuchung der Unterkunft) eine
        Bearbeitungsgebühr von Fr. 100.– pro Person, jedoch maximal Fr. 200.– pro Auftrag. Bei einer Annullierung kann Ihre
        Buchungsstelle zusätzliche Bearbeitungsspesen verlangen. Nach Beginn der Annullierungsfristen gelten die Bedingungen
        gemäss Ziffer 4.3.
      </p>
      <p>4.3 <strong>Kosten einer Annullierung/Änderung</strong> (in Prozenten des Reisepreises, zusätzlich zur Bearbeitungsgebühr):</p>
      <div className="rounded-xl p-4" style={{ background: '#f6f8fa', border: '1px solid #e5e8ed' }}>
        <p className="font-semibold" style={{ color: '#143047' }}>Pauschalreisen</p>
        <ul className="mt-1 space-y-1 text-sm">
          <li>60 – 45 Tage vor Abreise: 30%</li>
          <li>44 – 31 Tage vor Abreise: 60%</li>
          <li>30 – 1 Tage vor Abreise: 90%</li>
          <li>Am Abreisetag: 100%</li>
        </ul>
        <p className="mt-3 font-semibold" style={{ color: '#143047' }}>Tickets für kulturelle und sportliche Veranstaltungen</p>
        <ul className="mt-1 space-y-1 text-sm"><li>100% ab Buchung</li></ul>
        <p className="mt-3 font-semibold" style={{ color: '#143047' }}>Arrangements inkl. Tickets für Sport-/Kulturveranstaltungen, Flugtickets oder Tischreservierungen (Oktoberfest)</p>
        <ul className="mt-1 space-y-1 text-sm">
          <li>90% ab Buchung</li>
          <li>Am Abreisetag: 100%</li>
        </ul>
        <p className="mt-3 font-semibold" style={{ color: '#143047' }}>Gruppenreisen / Incentive-Reisen / Firmenevents</p>
        <ul className="mt-1 space-y-1 text-sm">
          <li>Ab Buchung bis 90 Tage vor Abreise: 70%</li>
          <li>89 – 30 Tage vor Abreise: 80%</li>
          <li>29 – 1 Tage vor Abreise: 90%</li>
          <li>Am Abreisetag: 100%</li>
        </ul>
      </div>
      <p>
        <strong>Eintrittskarten:</strong> Faltin-Travel tritt beim Kauf von Eintrittskarten, die nicht Bestandteil einer
        Reise sind, lediglich als Vermittler auf. Sie schuldet nur die Vermittlung der Eintrittskarte. Für die Durchführung
        der Veranstaltung bzw. die Einlassregelungen am Veranstaltungsort ist sie nicht verantwortlich. Umtausch oder
        Stornierung von Eintrittskarten sind nach Buchung nicht möglich. Faltin-Travel kann lediglich versuchen, die
        Eintrittskarten (abzüglich einer Bearbeitungsgebühr von 30%) weiter zu verkaufen. Bei Terminverlegungen von
        Veranstaltungen bleiben alle Vereinbarungen gültig, der Kunde ist verpflichtet, sich selbst über allfällige
        Terminverlegungen zu informieren. In der Regel erfolgt die Lieferung zwei Wochen vor der Veranstaltung.
      </p>
      <p>
        Das Angebot von Faltin Travel basiert grundsätzlich auf einer vom Veranstalter prognostizierten Stadionauslastung
        von 100%. Sollte die Stadionauslastung seitens des Veranstalters auf unter 75% reduziert werden, behält sich Faltin
        Travel das Recht vor, Tickets in alternativen Ticketkategorien mit entsprechender Rückerstattung zu liefern. Sollte
        der Kunde die Lieferung alternativer Ticketkategorien nicht akzeptieren, besteht für ihn die Möglichkeit der
        Stornierung mit vollständiger Rückerstattung. Kommt der Veranstalter/Lieferant seiner Leistungspflicht
        (Ticketlieferung) nicht nach, so gewährleistet die Faltin Travel AG die vollständige Rückerstattung des Kaufpreises.
      </p>
      <p>
        <strong>Umbuchungen:</strong> Nach Antritt der Reise sind Umbuchungen grundsätzlich nicht möglich, ausser in
        dringenden Ausnahmefällen (Krankheit), und auch dann nur, sofern Platz vorhanden ist. Die Umbuchungsspesen betragen
        Fr. 100.– pro Person, jedoch max. Fr. 200.– pro Auftrag plus eventuelle Tarifdifferenzen. Telefonische Umbuchungen
        können aus administrativen Gründen nicht akzeptiert werden.
      </p>
      <p>
        4.4 <strong>Ersatzperson:</strong> Sollte der Kunde die Reise nicht antreten können, hat er die Möglichkeit, bis zum
        Reisebeginn eine Ersatzperson zu stellen, die an seiner Stelle in die Rechte und Pflichten aus dem Reisevertrag
        eintritt und die er Faltin-Travel zuvor anzuzeigen hat. Faltin-Travel behält sich das Recht vor, diese Person
        abzulehnen, wenn sie den besonderen Erfordernissen der Reise nicht entspricht. Die in den Vertrag eintretende
        Ersatzperson und der ursprünglich Reisende haften solidarisch für die Zahlung des Reisepreises und sämtlicher durch
        den Eintritt der Ersatzperson entstehender Mehrkosten.
      </p>

      <LegalH2 id="agb-05">5. Beanstandungen / Ersatzansprüche</LegalH2>
      <p>
        5.1 Ist es nicht möglich, eine Reise wie im Faltin-Travel-Katalog versprochen oder mit Ihnen vereinbart
        durchzuführen, so bemühen wir uns – ohne Übernahme einer Haftung für das Gelingen – um eine Ersatzlösung, damit der
        objektive Zweck oder Charakter der Reise möglichst beibehalten werden kann.
      </p>
      <p>
        5.2 Sollten Sie während der Reise Anlass zu Beanstandungen haben, so müssen Sie diese unverzüglich, spätestens aber
        innert 24 Stunden, Faltin-Travel direkt, der Faltin-Travel-Vertretung vor Ort oder dem Leistungsträger bekanntgeben.
        Dies ist eine notwendige Voraussetzung für die spätere Geltendmachung Ihrer Ersatzansprüche. Führt Ihre
        Intervention zu keiner angemessenen Lösung, so sind Sie verpflichtet, eine schriftliche Bestätigung zu verlangen,
        die Ihre Beanstandung und deren Inhalt festhält.
      </p>
      <p>
        5.3 Sie sind berechtigt, die Mängel Ihrer Reise selber zu beheben, sofern der Leistungsträger Ihnen nicht spätestens
        innert 48 Stunden eine angemessene Lösung anbietet. Die dadurch entstehenden Kosten werden Ihnen im Rahmen der
        gesetzlichen und vertraglichen Haftung von Faltin-Travel gegen Beleg ersetzt.
      </p>
      <p>
        5.4 Ihr Ersatzbegehren und die Bestätigung der Faltin-Travel ist spätestens innerhalb von 4 Wochen nach der
        vereinbarten Beendigung Ihrer Reise schriftlich bei Ihrem Reisebüro oder dem Faltin-Travel-Hauptsitz in Regensdorf
        einzureichen. Falls Sie diese Bedingungen nicht einhalten, erlischt jeglicher Schadenersatzanspruch.
      </p>

      <LegalH2 id="agb-06">6. Abbruch, Nichtdurchführung, Programmänderung</LegalH2>
      <p>
        6.1 Die von uns angebotenen Reisen können auf einer Mindestbeteiligung basieren, die unterschiedlich sein kann. Wird
        die für Ihre Reise massgebliche Mindestbeteiligung nicht erreicht, so ist Faltin-Travel berechtigt, diese bis
        spätestens drei Wochen vor dem festgelegten Reisebeginn zu annullieren. Faltin-Travel bemüht sich in jedem Fall,
        Ihnen ein gleichwertiges Ersatzprogramm zu offerieren. Die bereits geleisteten Zahlungen werden Ihnen
        zurückerstattet, wenn dies nicht möglich ist oder Sie auf das Ersatzprogramm verzichten. Weitergehende
        Ersatzforderungen sind ausgeschlossen.
      </p>
      <p>
        6.2 Faltin-Travel behält sich auch in Ihrem Interesse vor, Programme oder einzelne vereinbarte Leistungen (z.B.
        Unterkunft, Transportart, Transportmittel-Typ, Fluggesellschaften, Ausflüge usw.) zu ändern, wenn unvorhergesehene
        Umstände es erfordern. In seltenen Fällen ist Faltin-Travel auch gezwungen, Ihre Reise aus Gründen, die ausserhalb
        unserer Einwirkungsmöglichkeiten liegen, abzusagen, sei es zu Ihrer Sicherheit oder aus anderen zwingenden
        Umständen, wie z.B. Nichterteilung oder Entziehung von Landerechten, höhere Gewalt, verspätete Eröffnungen von
        Hotels, kriegerische Ereignisse, Unruhen, Streiks usw.
      </p>
      <p>
        6.3 Muss Faltin-Travel eine von Ihnen bereits bezahlte Reise ändern, so dass ein objektiver Minderwert zur
        ursprünglich vereinbarten Leistung entsteht, erhalten Sie von Faltin-Travel eine Rückvergütung. Entstehen jedoch
        Mehrkosten und beträgt diese Erhöhung mehr als 10% des ursprünglich vereinbarten Reisepreises, steht Ihnen das Recht
        zu, innert 5 Tagen nach Erhalt unserer Mitteilung kostenlos vom Vertrag zurückzutreten.
      </p>
      <p>
        6.4 Bei Überbuchungsproblemen behalten wir uns vor, Sie auch kurzfristig zu informieren. Wir werden bemüht sein,
        Ihnen eine Ersatzlösung anzubieten. 6.5 Wir behalten uns das Recht vor, eine namentlich bezeichnete Fluggesellschaft
        durch eine andere zu ersetzen. Der Name der neuen Fluggesellschaft wird Ihnen baldmöglichst mitgeteilt.
      </p>

      <LegalH2 id="agb-07">7. Vorzeitiger Abbruch oder Änderungen während der Reise durch den Kunden</LegalH2>
      <p>
        Falls Sie die Reise aus irgendeinem Grunde vorzeitig abbrechen müssen oder Leistungen daraus ändern wollen, sind wir
        grundsätzlich zu keiner Rückerstattung verpflichtet. Im Weiteren empfehlen wir Ihnen den Abschluss einer
        Rückreisekostenversicherung, die, wenn Sie die Reise aus einem dringenden Grund (z.B. eigene Erkrankung oder
        Unfall, schwere Erkrankung oder Tod von Angehörigen etc.) vorzeitig abbrechen müssen, für die entstehenden Kosten
        aufkommt. Faltin-Travel wird Ihnen bei der Organisation der vorzeitigen Rückreise oder bei Änderungswünschen so weit
        wie möglich behilflich sein.
      </p>

      <LegalH2 id="agb-08">8. Pass, Visa, Impfungen</LegalH2>
      <p>
        8.1 Über die geltenden Einreisebestimmungen für Bürger/innen von Staaten, die nicht in unseren bereits vorhandenen
        und Ihnen ausgehändigten Informationen erwähnt sind, informiert Sie Ihre Buchungsstelle auf Ihre Bitte hin. Auf
        Wunsch unterstützt Sie Ihr Reisebüro gerne bei der Einholung allfällig erforderlicher Visa. Die Einholungskosten
        werden Ihnen von Ihrer Buchungsstelle weiterverrechnet.
      </p>
      <p>
        8.2 Faltin-Travel kann keine Haftung übernehmen für eine Einreiseverweigerung aufgrund nicht eingeholter oder nicht
        erhaltener Visa. Für die Einhaltung der vorgeschriebenen Pass-, Visa-, Zoll-, Devisen- und Gesundheitsbestimmungen
        sind Sie allein verantwortlich.
      </p>

      <LegalH2 id="agb-09">9. Haftung</LegalH2>
      <p>
        9.1 <strong>Im Allgemeinen:</strong> Als erfahrener Reiseveranstalter garantieren wir Ihnen im Rahmen unseres
        eigenen Reiseveranstaltungsangebotes eine sorgfältige Auswahl und Überwachung der anderen an Ihrer Reise beteiligten
        Unternehmen (Flug- und Schifffahrtsgesellschaften, Busunternehmen, Hotels usw.). Unsere Haftung ist, soweit
        zulässig, auf insgesamt den zweifachen Reisepreis beschränkt und erfasst nur den unmittelbaren Schaden.
      </p>
      <p>
        9.2 <strong>Haftungsbeschränkungen und -ausschlüsse:</strong> Enthalten internationale Abkommen, auf
        internationalen Abkommen beruhende Gesetze oder nationale Gesetze Beschränkungen oder Ausschlüsse der Entschädigung
        bei Schäden aus Nichterfüllung oder nicht gehöriger Vertragserfüllung, so haftet Faltin-Travel nur im Rahmen dieser
        Abkommen und Gesetze (insbesondere im Transportwesen wie Luftverkehr, Schifffahrt und Eisenbahnverkehr).
        Faltin-Travel übernimmt keine Haftung, falls infolge Flugverspätungen oder Streiks Programmänderungen erfolgen
        müssen, sowie bei höherer Gewalt, behördlichen Anordnungen oder Verspätungen von Dritten.
      </p>
      <p>
        9.3 <strong>Lokal gebuchte Veranstaltungen und Ausflüge:</strong> Bei der Buchung von lokalen Veranstaltungen,
        Ausflügen oder Besichtigungen etc. durch Faltin-Travel tritt Faltin Travel lediglich als Vermittler auf. Es gelten
        ausschliesslich die Bestimmungen der lokalen Veranstalter. Faltin-Travel lehnt hierfür jegliche Haftung ab, sofern
        nicht ausdrücklich Faltin-Travel oder unsere örtliche Vertretung als Veranstalter verantwortlich zeichnet.
      </p>
      <p>
        9.4 <strong>Unfälle und Erkrankungen, Schwangerschaft:</strong> Faltin-Travel übernimmt die Haftung für den
        unmittelbaren Schaden bei Tod, Körperverletzung oder Erkrankung während der Reise, sofern diese von Faltin-Travel
        oder einem beauftragten Unternehmen schuldhaft verursacht wurde. Bei Schwangerschaft sind Sie verpflichtet, vor der
        Buchung den Veranstalter zu informieren und sich über die Transportbedingungen der Airlines und Reedereien zu
        erkundigen.
      </p>
      <p>
        9.5 <strong>Sicherstellung der Kundengelder:</strong> Wir sind als Reiseveranstalter Teilnehmer am Garantiefonds
        der Schweizer Reisebranche und garantieren Ihnen die Sicherstellung Ihrer im Zusammenhang mit der Buchung einer
        Pauschalreise einbezahlten Beiträge sowie Ihre Rückreise. Detaillierte Auskunft unter{' '}
        <a href="https://www.garantiefonds.ch" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#18395a] hover:underline">www.garantiefonds.ch</a>.
      </p>
      <div className="rounded-xl p-4" style={{ background: '#f3f7fc', border: '1px solid #e5e8ed' }}>
        <p className="font-semibold" style={{ color: '#143047' }}>Ombudsman</p>
        <p className="mt-1 text-sm">
          Vor einer gerichtlichen Auseinandersetzung sollten Sie an den unabhängigen Ombudsman der Schweizer Reisebranche
          gelangen.<br />
          Ombudsman der Schweizer Reisebranche, Etzelstrasse 42, Postfach, 8038 Zürich,{' '}
          <a href="https://www.ombudsman-touristik.ch" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#18395a] hover:underline">www.ombudsman-touristik.ch</a>
        </p>
      </div>
      <p>
        9.6 <strong>Zu Ihrer Sicherheit:</strong> Um Diskriminierung oder gar strafrechtliche Sanktionen zu vermeiden,
        sollten Sie sich über die lokalen Sitten und Gesetze informieren. Faltin-Travel übernimmt keine Haftung bei
        Verstössen. Wir gehen davon aus, dass Sie sich vor Antritt über die Reisehinweise des EDA informiert haben.
      </p>
      <p>
        9.7 <strong>Verjährung:</strong> Forderungen gegenüber Faltin-Travel verjähren innerhalb eines Jahres nach
        vertraglichem Reiseende. Vorbehalten bleiben kürzere resp. zwingende längere Verjährungsfristen aufgrund des
        anwendbaren nationalen und internationalen Rechts.
      </p>

      <LegalH2 id="agb-10">10. Flüge</LegalH2>
      <p>
        10.1 Unsere Angebote umfassen Reisen mit Flugzeugen des regulären Linienverkehrs sowie unsere Sonderflugprogramme.
        Falls nichts anderes angegeben ist, fliegen Sie in der Economy-Klasse. Die publizierten Flugpläne,
        Fluggesellschaften und Flugzeugtypen können ändern. Falls zwei oder mehrere Tickets pro Reisenden ausgestellt
        werden, haftet Faltin-Travel nicht für die Mindestumsteigezeit.
      </p>
      <p>
        10.2 <strong>Reisegepäck und Sportgeräte:</strong> Ihr Reisegepäck ist bei Flügen in der Economyclass auf 20 kg
        beschränkt. Für die USA und Kanada gelten spezielle Gepäckbestimmungen (grundsätzlich 1 Gepäckstück à 23 kg). Das
        Handgepäck ist bei vielen Fluggesellschaften auf ein Gepäckstück zwischen 5–10 kg beschränkt. Der Transport von
        Übergepäck und Sportgeräten ist nur bei Voranmeldung und gegen Gebühr möglich.
      </p>
      <p>
        10.3 <strong>E-Ticket:</strong> Alle Fluggesellschaften arbeiten nach dem Prinzip des papierlosen Flugtickets
        (E-Ticket). Der Reisende weist sich lediglich mit Reisepass oder Identitätskarte beim Check-in aus. 10.4{' '}
        <strong>Tiere:</strong> Tiere werden bei Sonderflügen in der Kabine grundsätzlich nicht akzeptiert. 10.5{' '}
        <strong>Gruppentarife:</strong> Unsere Reisen für Gruppen mit Linienflug basieren in der Regel auf Gruppentarifen.
        Die Mindestbeteiligung beträgt je nach Reise fünf oder mehr Personen. 10.6 <strong>Verspätungen:</strong>{' '}
        Faltin-Travel kann die Einhaltung von Fahrplänen nicht garantieren; bei Verspätungen haften wir nicht.
      </p>

      <LegalH2 id="agb-11">11. Sportmöglichkeiten</LegalH2>
      <p>
        In vielen unserer Hotels werden diverse Sportmöglichkeiten angeboten. Die Kapazität solcher Einrichtungen ist in der
        Regel begrenzt und bezüglich Qualität sind Abstriche zu akzeptieren. Oft werden Anlagen und Einrichtungen benützt,
        welche Dritten gehören. Wir können deshalb nicht garantieren, dass Sie die in unseren Ausschreibungen beschriebenen
        Sportarten jederzeit und uneingeschränkt ausüben können. Falls Sie eine bestimmte Sportart besonders interessiert,
        lassen Sie sich bitte vor Ihrer Abreise bestätigen, dass die Ausübung während Ihrer Ferienzeit auch tatsächlich
        möglich ist.
      </p>

      <LegalH2 id="agb-12">12. Datenschutz</LegalH2>
      <p>
        Für Faltin-Travel ist der Schutz der Privatsphäre und der persönlichen Daten von sehr grosser Wichtigkeit.
        Faltin-Travel hält sich bei der Beschaffung und Nutzung von Personendaten an die Bestimmungen der schweizerischen
        Datenschutzgesetzgebung. Detaillierte Informationen finden Sie in unserer{' '}
        <a href="/datenschutz" className="font-semibold text-[#18395a] hover:underline">Datenschutzerklärung</a>. Ihre Daten
        können unter Einhaltung der datenschutzrechtlichen Bestimmungen an Dritte (z.B. Leistungsträger) weitergegeben
        werden, soweit dies zur Geschäftsabwicklung notwendig ist. Auf Verlangen der Behörden bestimmter Länder kann es
        erforderlich sein, sog. „Passenger Name Record (PNR)"-Daten aus Sicherheits- und Einreisegründen zu übermitteln.
      </p>

      <LegalH2 id="agb-13">13. Anwendbares Recht und Gerichtsstand</LegalH2>
      <p>
        Im vertraglichen Verhältnis zwischen Ihnen und Faltin-Travel ist ausschliesslich schweizerisches Recht anwendbar.
        Klagen gegen Faltin-Travel sind an seinem Hauptsitz in Regensdorf anzubringen.
      </p>

      <LegalH2 id="agb-14">14. Versicherung</LegalH2>
      <p>
        14.1 <strong>Annullierungskosten-Versicherung / ELVIA Reiserücktritt-Vollschutz:</strong> Bei Buchung wird der
        Abschluss einer Annullierungskosten-Versicherung/Reiserücktritt-Vollschutz bei der ELVIA empfohlen. Diese deckt
        weder Spesen für Annullierungen von Flügen innerhalb von USA und Kanada noch für Eintrittskarten für Veranstaltungen
        (siehe 4.3.2). 14.2 <strong>Bearbeitungsgebühr:</strong> Die Bearbeitungsgebühr von Fr. 50.– pro Person, max. Fr.
        100.– pro Auftrag, ist durch die Annullierungskostenversicherung nicht gedeckt. 14.3{' '}
        <strong>Zusätzliche Versicherung:</strong> Da die Haftung der Reise- und Transportunternehmer beschränkt ist,
        empfehlen wir den Abschluss eines ergänzenden Versicherungsschutzes (Reise-/Assistance- und Gepäckversicherung).
      </p>

      <div className="mt-8 rounded-xl p-5" style={{ background: '#f3f7fc', border: '1px solid #e5e8ed' }}>
        <p className="text-sm text-gray-600">
          Im Falle von Auslegungsdifferenzen aufgrund von Unterschieden in den Formulierungen in den verschiedenen Sprachen
          ist die deutsche Version massgebend.
        </p>
        <p className="mt-3 text-sm font-semibold" style={{ color: '#143047' }}>Faltin-Travel AG, Regensdorf, Dezember 2023</p>
      </div>
    </LegalPage>
  );
}
