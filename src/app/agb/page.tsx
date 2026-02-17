import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function AGBPage() {
  return (
    <div className='min-h-screen bg-gray-50'>
      <header className='bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 text-white'>
        <div className='container mx-auto px-4 py-4'>
          <Link href='/' className='flex items-center gap-2 hover:text-blue-200 transition'>
            <ArrowLeft className='w-5 h-5' />
            <span className='text-xl font-bold'>Zurück zur Startseite</span>
          </Link>
        </div>
      </header>

      <div className='container mx-auto px-4 py-12 max-w-4xl'>
        <div className='bg-white rounded-xl shadow-lg p-8 md:p-12'>
          <h1 className='text-4xl font-bold text-gray-900 mb-4'>
            Allgemeine Geschäftsbedingungen
          </h1>
          <p className='text-sm text-gray-600 mb-8'>
            Faltin Travel AG, Regensdorf | Stand: Dezember 2023
          </p>

          <nav className='bg-blue-50 rounded-lg p-6 mb-8'>
            <h2 className='font-bold text-gray-900 mb-3'>Inhaltsverzeichnis</h2>
            <ul className='grid md:grid-cols-2 gap-2 text-sm text-blue-700'>
              <li><a href='#agb-01' className='hover:underline'>01. Allgemeine Reise- und Vertragsbedingungen</a></li>
              <li><a href='#agb-02' className='hover:underline'>02. Abschluss des Reisevertrages</a></li>
              <li><a href='#agb-03' className='hover:underline'>03. Preise und Zahlungsbedingungen</a></li>
              <li><a href='#agb-04' className='hover:underline'>04. Annullierung / Änderung der Reise</a></li>
              <li><a href='#agb-05' className='hover:underline'>05. Beanstandungen / Ersatzansprüche</a></li>
              <li><a href='#agb-06' className='hover:underline'>06. Abbruch, Nichtdurchführung, Programmänderung</a></li>
              <li><a href='#agb-07' className='hover:underline'>07. Vorzeitiger Abbruch durch den Kunden</a></li>
              <li><a href='#agb-08' className='hover:underline'>08. Pass, Visa, Impfungen</a></li>
              <li><a href='#agb-09' className='hover:underline'>09. Haftung</a></li>
              <li><a href='#agb-10' className='hover:underline'>10. Flüge</a></li>
              <li><a href='#agb-11' className='hover:underline'>11. Sportmöglichkeiten</a></li>
              <li><a href='#agb-12' className='hover:underline'>12. Datenschutz</a></li>
              <li><a href='#agb-13' className='hover:underline'>13. Anwendbares Recht und Gerichtsstand</a></li>
              <li><a href='#agb-14' className='hover:underline'>14. Versicherung</a></li>
              <li><a href='#agb-15' className='hover:underline'>15. Copyright</a></li>
            </ul>
          </nav>

          <div className='prose prose-sm max-w-none space-y-8'>
            <section id='agb-01'>
              <h2 className='text-2xl font-bold text-gray-900 mb-3'>1. Allgemeine Reise- und Vertragsbedingungen</h2>
              <p className='text-gray-700 leading-relaxed'>
                Wir freuen uns, dass Sie sich für eine Reise mit Faltin Travel AG, mit Sitz in Regensdorf (nachfolgend „Faltin-Travel" genannt") interessieren und danken für Ihr Vertrauen.
              </p>
              <p className='text-gray-700 leading-relaxed mt-3'>
                Die nachfolgenden Allgemeinen Reise- und Vertragsbedingungen gelten für alle Reiseteilnehmer/innen und regeln die Rechtsbeziehung zwischen Ihnen als Kunden und uns als Reiseveranstalter. Die nachfolgenden Allgemeinen Reise- und Vertragsbedingungen sind Bestandteil des Vertrages zwischen Ihnen und Faltin-Travel. Mit der Buchung erklären Sie sich mit den vorliegenden Reise- und Vertragsbedingungen einverstanden. Die jeweils aktuelle Fassung dieser Reise- und Vertragsbedingungen wird auch auf faltintravel.com veröffentlicht. Abweichungen von diesen Reise- und Vertragsbedingungen gelten nur, soweit Faltin-Travel ausdrücklich und schriftlich zugestimmt hat.
              </p>
            </section>

            <section id='agb-02'>
              <h2 className='text-2xl font-bold text-gray-900 mb-3'>2. Abschluss des Reisevertrages</h2>
              
              <h3 className='text-lg font-semibold text-gray-900 mt-4 mb-2'>2.1 Vertragsabschluss</h3>
              <p className='text-gray-700 leading-relaxed'>
                Der Vertrag zwischen Ihnen und Faltin-Travel kommt mit der Entgegennahme Ihrer persönlichen, schriftlichen oder telefonischen Buchung zustande. Bei schriftlichen Buchungen, per Fax, E-Mail, SMS oder über unsere Webseite, erhalten Sie eine schriftliche Annahme Ihrer Anmeldung. Sowohl bei telefonischer oder persönlicher wie aber auch bei schriftlicher Buchung bestätigt Ihnen Faltin-Travel Ihre Buchung durch schriftliche Zusammenstellung des gebuchten Reisearrangement (nachfolgend „Buchungsbestätigung" genannt).
              </p>
              <p className='text-gray-700 leading-relaxed mt-3'>
                Faltin-Travel handelt in allen anderen Fällen lediglich als Vermittler von Leistungen Dritter (siehe 2.2). Sollten Sie weitere Reiseteilnehmer/innen anmelden, so haben Sie für deren Vertragspflichten (insbesondere für die Bezahlung des Reisepreises) wie für Ihre eigenen Verpflichtungen einzustehen.
              </p>

              <h3 className='text-lg font-semibold text-gray-900 mt-4 mb-2'>2.2 Vermittlung</h3>
              <p className='text-gray-700 leading-relaxed'>
                Vermitteln Ihnen Drittanbieter oder andere Reiseveranstalter einzelne Reisenebenleistungen (z.B. Hotel, Eintrittskarten etc.) oder Reisearrangements, so gelten deren eigene Reise- und Vertragsbedingungen. Vermittelt Faltin-Travel Nur-Flug-Arrangements mit Linienflügen, so gelten die allgemeinen Vertrags- und Reisebedingungen der zuständigen Airline.
              </p>

              <h3 className='text-lg font-semibold text-gray-900 mt-4 mb-2'>2.3 Namensangaben</h3>
              <p className='text-gray-700 leading-relaxed'>
                Bei der Buchung sind Sie verpflichtet, Ihren Namen und die Namen der Mitreisenden wie in den für die Reise verwendeten Personalausweisen (Pass, usw.) anzugeben. Stimmen die Namen auf den Reisedokumenten/Flugschein nicht mit den Namen auf dem Personalausweis überein, so kann Ihnen die Reiseleistung verweigert werden oder es entstehen Kosten für die Neuausstellung des Tickets.
              </p>
            </section>

            <section id='agb-03'>
              <h2 className='text-2xl font-bold text-gray-900 mb-3'>3. Preise und Zahlungsbedingungen</h2>
              
              <h3 className='text-lg font-semibold text-gray-900 mt-4 mb-2'>3.1 Preise</h3>
              <p className='text-gray-700 leading-relaxed'>
                Die von Faltin-Travel in Prospekten oder auf der Homepage angegebenen Preise gelten als unverbindliche Preisempfehlung. Für den Kunden gelten die im Zeitpunkt der Buchung gültigen und auf der Buchungsbestätigung ausgewiesenen Preise. Wenn nicht explizit anders angegeben, verstehen sich die Preise pro Person in Schweizer Franken mit Unterkunft in Doppelzimmern bei Zweierbelegung. Alle Preise verstehen sich inklusive der gesetzlichen Mehrwertsteuer und sind Barzahlungspreise.
              </p>

              <h3 className='text-lg font-semibold text-gray-900 mt-4 mb-2'>3.2 Zahlungsbedingungen</h3>
              <div className='bg-blue-50 rounded-lg p-4 mt-3'>
                <p className='text-gray-800 font-semibold mb-2'>Anzahlung:</p>
                <p className='text-gray-700 text-sm'>
                  Bei Buchung ist gleichzeitig eine Anzahlung von 30% des vereinbarten Reisepreises zu leisten. Bei Buchungen weniger als 45 Tage vor Abreise, bei Buchungen von „Nur Eintrittskarten" oder Arrangements, die Eintrittskarten oder Flugtickets beinhalten, ist der gesamte Rechnungsbetrag zu bezahlen.
                </p>
                <p className='text-gray-800 font-semibold mt-3 mb-2'>Restzahlung:</p>
                <p className='text-gray-700 text-sm'>
                  Die Restzahlung ist 45 Tage vor Reiseantritt fällig. Die Reisedokumente werden nach Zahlungseingang ca. 14 Tage vor Reiseantritt zugestellt.
                </p>
              </div>

              <h3 className='text-lg font-semibold text-gray-900 mt-4 mb-2'>3.3 Preisänderungen</h3>
              <p className='text-gray-700 leading-relaxed'>
                Faltin-Travel behält sich vor, den Reisepreis zu erhöhen im Falle von: Druckfehlern, Tarifänderungen von Transportunternehmen, neu eingeführten Gebühren, Wechselkursänderungen, staatlich verfügten Preiserhöhungen oder außerordentlichen Preiserhöhungen von Hotels. Beträgt die Preiserhöhung mehr als 10%, haben Sie das Recht, innerhalb von 5 Tagen kostenlos vom Vertrag zurückzutreten.
              </p>
            </section>

            <section id='agb-04'>
              <h2 className='text-2xl font-bold text-gray-900 mb-3'>4. Annullierung / Änderung der Reise</h2>
              
              <h3 className='text-lg font-semibold text-gray-900 mt-4 mb-2'>4.1 Annullierungsfristen</h3>
              <p className='text-gray-700 leading-relaxed mb-3'>
                Eine Annullierung/Änderung einer bereits gebuchten Reise muss grundsätzlich schriftlich erfolgen.
              </p>

              <h3 className='text-lg font-semibold text-gray-900 mt-4 mb-2'>4.2 Bearbeitungsgebühren</h3>
              <p className='text-gray-700 leading-relaxed'>
                Bis zu Beginn der Annullierungsfristen erheben wir für Annullierungen und Änderungen eine Bearbeitungsgebühr von CHF 100.– pro Person, jedoch maximal CHF 200.– pro Auftrag.
              </p>

              <h3 className='text-lg font-semibold text-gray-900 mt-4 mb-2'>4.3 Kosten einer Annullierung</h3>
              <div className='bg-gray-100 rounded-lg p-4 mt-3'>
                <p className='font-semibold text-gray-900 mb-3'>Pauschalreisen:</p>
                <ul className='space-y-2 text-sm text-gray-700'>
                  <li>• 60–45 Tage vor Abreise: 30%</li>
                  <li>• 44–31 Tage vor Abreise: 60%</li>
                  <li>• 30–1 Tage vor Abreise: 90%</li>
                  <li>• Am Abreisetag: 100%</li>
                </ul>

                <p className='font-semibold text-gray-900 mt-4 mb-3'>Arrangements inkl. Sportveranstaltungen oder Flugtickets:</p>
                <ul className='space-y-2 text-sm text-gray-700'>
                  <li>• 90% ab Buchung</li>
                  <li>• 100% am Abreisetag</li>
                </ul>

                <p className='font-semibold text-gray-900 mt-4 mb-3'>Eintrittskarten für Veranstaltungen:</p>
                <ul className='space-y-2 text-sm text-gray-700'>
                  <li>• 100% ab Buchung (keine Stornierung möglich)</li>
                </ul>
              </div>

              <h3 className='text-lg font-semibold text-gray-900 mt-4 mb-2'>4.4 Ersatzperson</h3>
              <p className='text-gray-700 leading-relaxed'>
                Sollte der Kunde die Reise nicht antreten können, hat er die Möglichkeit, bis zum Reisebeginn eine Ersatzperson zu stellen. Faltin-Travel behält sich das Recht vor, diese Person abzulehnen, wenn sie den besonderen Erfordernissen der Reise nicht entspricht.
              </p>
            </section>

            <section id='agb-05'>
              <h2 className='text-2xl font-bold text-gray-900 mb-3'>5. Beanstandungen / Ersatzansprüche</h2>
              <p className='text-gray-700 leading-relaxed'>
                Sollten Sie während der Reise Anlass zu Beanstandungen haben, so müssen Sie diese unverzüglich, spätestens aber innert 24 Stunden, Faltin-Travel direkt, der Faltin-Travel-Vertretung vor Ort oder dem Leistungsträger bekanntgeben. Dies ist eine notwendige Voraussetzung für die spätere Geltendmachung Ihrer Ersatzansprüche.
              </p>
              <p className='text-gray-700 leading-relaxed mt-3'>
                Ihr Ersatzbegehren ist spätestens innerhalb von 4 Wochen nach der vereinbarten Beendigung Ihrer Reise schriftlich einzureichen. Falls Sie diese Bedingungen nicht einhalten, erlischt jeglicher Schadenersatzanspruch.
              </p>
            </section>

            <section id='agb-06'>
              <h2 className='text-2xl font-bold text-gray-900 mb-3'>6. Abbruch, Nichtdurchführung, Programmänderung</h2>
              <p className='text-gray-700 leading-relaxed'>
                Die von uns angebotenen Reisen können auf einer Mindestbeteiligung basieren. Wird diese nicht erreicht, ist Faltin-Travel berechtigt, die Reise bis spätestens drei Wochen vor Reisebeginn zu annullieren.
              </p>
              <p className='text-gray-700 leading-relaxed mt-3'>
                Faltin-Travel behält sich vor, Programme oder einzelne vereinbarte Leistungen zu ändern, wenn unvorhergesehene Umstände es erfordern. Dies gilt auch bei höherer Gewalt, kriegerischen Ereignissen, Unruhen oder Streiks.
              </p>
            </section>

            <section id='agb-07'>
              <h2 className='text-2xl font-bold text-gray-900 mb-3'>7. Vorzeitiger Abbruch durch den Kunden</h2>
              <p className='text-gray-700 leading-relaxed'>
                Falls Sie die Reise aus irgendeinem Grunde vorzeitig abbrechen müssen, sind wir grundsätzlich zu keiner Rückerstattung verpflichtet. Wir empfehlen den Abschluss einer Rückreisekostenversicherung.
              </p>
            </section>

            <section id='agb-08'>
              <h2 className='text-2xl font-bold text-gray-900 mb-3'>8. Pass, Visa, Impfungen</h2>
              <p className='text-gray-700 leading-relaxed'>
                Über die geltenden Einreisebestimmungen informiert Sie Ihre Buchungsstelle auf Anfrage. Faltin-Travel kann keine Haftung übernehmen für eine Einreiseverweigerung aufgrund nicht eingeholter oder nicht erhaltener Visa. Für die Einhaltung der vorgeschriebenen Pass-, Visa-, Zoll-, Devisen- und Gesundheitsbestimmungen sind Sie allein verantwortlich.
              </p>
            </section>

            <section id='agb-09'>
              <h2 className='text-2xl font-bold text-gray-900 mb-3'>9. Haftung</h2>
              
              <h3 className='text-lg font-semibold text-gray-900 mt-4 mb-2'>9.1 Im Allgemeinen</h3>
              <p className='text-gray-700 leading-relaxed'>
                Als Reiseveranstalter garantieren wir eine sorgfältige Auswahl und Überwachung der an Ihrer Reise beteiligten Unternehmen. Unsere Haftung ist, soweit zulässig, auf insgesamt den zweifachen Reisepreis beschränkt und erfasst nur den unmittelbaren Schaden.
              </p>

              <h3 className='text-lg font-semibold text-gray-900 mt-4 mb-2'>9.2 Haftungsbeschränkungen</h3>
              <p className='text-gray-700 leading-relaxed'>
                Internationale Abkommen und nationale Gesetze mit Haftungsbeschränkungen und Haftungsausschlüssen bestehen insbesondere im Transportwesen (Luftverkehr, Schifffahrt, Eisenbahnverkehr). Eine weitergehende Haftung von Faltin-Travel ist in diesen Fällen ausgeschlossen.
              </p>

              <h3 className='text-lg font-semibold text-gray-900 mt-4 mb-2'>9.3 Sicherstellung der Kundengelder</h3>
              <p className='text-gray-700 leading-relaxed'>
                Wir sind Teilnehmer am Garantiefonds der Schweizer Reisebranche und garantieren die Sicherstellung Ihrer einbezahlten Beiträge sowie Ihre Rückreise. Detaillierte Auskunft unter: <a href='https://www.garantiefonds.ch' className='text-blue-600 hover:underline'>www.garantiefonds.ch</a>
              </p>

              <div className='bg-blue-50 rounded-lg p-4 mt-4'>
                <p className='font-semibold text-gray-900 mb-2'>Ombudsman</p>
                <p className='text-sm text-gray-700'>
                  Ombudsman der Schweizer Reisebranche<br />
                  Etzelstrasse 42, Postfach, 8038 Zürich<br />
                  <a href='https://www.ombudsman-touristik.ch' className='text-blue-600 hover:underline'>www.ombudsman-touristik.ch</a>
                </p>
              </div>
            </section>

            <section id='agb-10'>
              <h2 className='text-2xl font-bold text-gray-900 mb-3'>10. Flüge</h2>
              <p className='text-gray-700 leading-relaxed'>
                Unsere Angebote umfassen Reisen mit Flugzeugen des regulären Linienverkehrs sowie Sonderflugprogramme. Falls nichts anderes angegeben ist, fliegen Sie in der Economy-Klasse. Die publizierten Flugpläne, Fluggesellschaften und Flugzeugtypen können ändern.
              </p>
              <p className='text-gray-700 leading-relaxed mt-3'>
                Ihr Reisegepäck ist bei Flügen in der Economy-Klasse auf 20 kg beschränkt. Für die USA und Kanada gelten spezielle Gepäckbestimmungen (meist 1 Gepäckstück à 23 kg).
              </p>
            </section>

            <section id='agb-11'>
              <h2 className='text-2xl font-bold text-gray-900 mb-3'>11. Sportmöglichkeiten</h2>
              <p className='text-gray-700 leading-relaxed'>
                Die Kapazität von Sporteinrichtungen in Hotels ist in der Regel begrenzt. Wir können nicht garantieren, dass Sie die in unseren Ausschreibungen beschriebenen Sportarten jederzeit und uneingeschränkt ausüben können.
              </p>
            </section>

            <section id='agb-12'>
              <h2 className='text-2xl font-bold text-gray-900 mb-3'>12. Datenschutz</h2>
              <p className='text-gray-700 leading-relaxed'>
                Für Faltin-Travel ist der Schutz der Privatsphäre und der persönlichen Daten von sehr grosser Wichtigkeit. Faltin-Travel hält sich bei der Beschaffung und Nutzung von Personendaten an die Bestimmungen der schweizerischen Datenschutzgesetzgebung.
              </p>
              <p className='text-gray-700 leading-relaxed mt-3'>
                Detaillierte Informationen finden Sie in unserer <Link href='/datenschutz' className='text-blue-600 hover:underline font-semibold'>Datenschutzerklärung</Link>.
              </p>
            </section>

            <section id='agb-13'>
              <h2 className='text-2xl font-bold text-gray-900 mb-3'>13. Anwendbares Recht und Gerichtsstand</h2>
              <p className='text-gray-700 leading-relaxed'>
                Im vertraglichen Verhältnis zwischen Ihnen und Faltin-Travel ist ausschliesslich schweizerisches Recht anwendbar. Klagen gegen Faltin-Travel sind an seinem Hauptsitz in Regensdorf anzubringen.
              </p>
            </section>

            <section id='agb-14'>
              <h2 className='text-2xl font-bold text-gray-900 mb-3'>14. Versicherung</h2>
              
              <h3 className='text-lg font-semibold text-gray-900 mt-4 mb-2'>14.1 Annullierungskosten-Versicherung</h3>
              <p className='text-gray-700 leading-relaxed'>
                Bei Buchung wird der Abschluss einer Annullierungskosten-Versicherung/Reiserücktritt-Vollschutz bei der ELVIA empfohlen. Die Bearbeitungsgebühr von CHF 50.– pro Person (max. CHF 100.– pro Auftrag) ist durch die Versicherung nicht gedeckt.
              </p>

              <h3 className='text-lg font-semibold text-gray-900 mt-4 mb-2'>14.2 Zusätzliche Versicherung</h3>
              <p className='text-gray-700 leading-relaxed'>
                Da die Haftung der Reise- und Transportunternehmer beschränkt ist, empfehlen wir den Abschluss einer ergänzenden Reiseversicherung (Kranken-, Unfall- und Gepäckversicherung).
              </p>
            </section>

            <section id='agb-15'>
              <h2 className='text-2xl font-bold text-gray-900 mb-3'>15. Copyright</h2>
              <p className='text-gray-700 leading-relaxed'>
                Alle Rechte vorbehalten. Die Reproduktion von Texten, Bildern oder anderen Inhalten aus den Publikationen von Faltin Travel ist ohne schriftliche Genehmigung nicht gestattet.
              </p>
            </section>

            <div className='bg-gray-100 rounded-lg p-6 mt-12'>
              <p className='text-sm text-gray-600'>
                Im Falle von Auslegungsdifferenzen aufgrund von Unterschieden in den Formulierungen in den verschiedenen Sprachen ist die deutsche Version massgebend.
              </p>
              <p className='text-sm text-gray-900 font-semibold mt-4'>
                Faltin-Travel AG, Regensdorf | Dezember 2023
              </p>
            </div>
          </div>

          <div className='mt-8 pt-8 border-t'>
            <Link 
              href='/booking' 
              className='inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold'
            >
              <ArrowLeft className='w-4 h-4' />
              Zurück zum Buchungsformular
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
