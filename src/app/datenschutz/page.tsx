import type { Metadata } from 'next';
import LegalPage, { LegalH2, LegalH3 } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Datenschutzerklärung | Faltin Travel AG',
  description: 'Informationen zur Verarbeitung personenbezogener Daten bei der Faltin Travel AG: Art, Umfang, Zweck und Rechtsgrundlagen sowie Ihre Rechte als Betroffene.',
  alternates: { canonical: '/datenschutz' },
};

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#18395a] break-words hover:underline">{children}</a>
);

export default function DatenschutzPage() {
  return (
    <LegalPage
      title="Datenschutzerklärung"
      subtitle="Informationen zu Art, Umfang, Zweck, Dauer und Rechtsgrundlage der Verarbeitung Ihrer personenbezogenen Daten."
      breadcrumb={[
        { name: 'Start', href: '/' },
        { name: 'Datenschutzerklärung', href: '/datenschutz' },
      ]}
    >
      <p>
        Personenbezogene Daten (nachfolgend zumeist nur „Daten" genannt) werden von uns nur im Rahmen der Erforderlichkeit
        sowie zum Zwecke der Bereitstellung eines funktionsfähigen und nutzerfreundlichen Internetauftritts, inklusive
        seiner Inhalte und der dort angebotenen Leistungen, verarbeitet.
      </p>
      <p>
        Gemäss Art. 4 Ziffer 1. der Verordnung (EU) 2016/679, also der Datenschutz-Grundverordnung (nachfolgend nur
        „DSGVO" genannt), gilt als „Verarbeitung" jeder mit oder ohne Hilfe automatisierter Verfahren ausgeführte Vorgang
        oder jede solche Vorgangsreihe im Zusammenhang mit personenbezogenen Daten, wie das Erheben, das Erfassen, die
        Organisation, das Ordnen, die Speicherung, die Anpassung oder Veränderung, das Auslesen, das Abfragen, die
        Verwendung, die Offenlegung durch Übermittlung, Verbreitung oder eine andere Form der Bereitstellung, den Abgleich
        oder die Verknüpfung, die Einschränkung, das Löschen oder die Vernichtung.
      </p>
      <p>
        Mit der nachfolgenden Datenschutzerklärung informieren wir Sie insbesondere über Art, Umfang, Zweck, Dauer und
        Rechtsgrundlage der Verarbeitung personenbezogener Daten, soweit wir entweder allein oder gemeinsam mit anderen
        über die Zwecke und Mittel der Verarbeitung entscheiden. Zudem informieren wir Sie nachfolgend über die von uns zu
        Optimierungszwecken sowie zur Steigerung der Nutzungsqualität eingesetzten Fremdkomponenten, soweit hierdurch
        Dritte Daten in wiederum eigener Verantwortung verarbeiten.
      </p>

      <LegalH2 id="verantwortliche">I. Informationen über uns als Verantwortliche</LegalH2>
      <p>Verantwortlicher Anbieter dieses Internetauftritts im datenschutzrechtlichen Sinne ist:</p>
      <p>
        <strong>Faltin Travel AG</strong><br />
        Riedthofstrasse 172<br />
        8105 Regensdorf<br />
        Schweiz
      </p>
      <p>
        Telefon: +41 44 700 22 77<br />
        Telefax: +41 44 740 33 27<br />
        E-Mail: <a href="mailto:info@faltintravel.com" className="font-semibold text-[#18395a] hover:underline">info@faltintravel.com</a>
      </p>
      <p>Datenschutzbeauftragter ist: Stefan Faltin</p>

      <LegalH2 id="rechte">II. Rechte der Nutzer und Betroffenen</LegalH2>
      <p>Mit Blick auf die nachfolgend noch näher beschriebene Datenverarbeitung haben die Nutzer und Betroffenen das Recht</p>
      <ul className="list-disc space-y-2 pl-5">
        <li>auf Bestätigung, ob sie betreffende Daten verarbeitet werden, auf Auskunft über die verarbeiteten Daten, auf weitere Informationen über die Datenverarbeitung sowie auf Kopien der Daten (vgl. auch Art. 15 DSGVO);</li>
        <li>auf Berichtigung oder Vervollständigung unrichtiger bzw. unvollständiger Daten (vgl. auch Art. 16 DSGVO);</li>
        <li>auf unverzügliche Löschung der sie betreffenden Daten (vgl. auch Art. 17 DSGVO), oder, alternativ, soweit eine weitere Verarbeitung gemäss Art. 17 Abs. 3 DSGVO erforderlich ist, auf Einschränkung der Verarbeitung nach Massgabe von Art. 18 DSGVO;</li>
        <li>auf Erhalt der sie betreffenden und von ihnen bereitgestellten Daten und auf Übermittlung dieser Daten an andere Anbieter/Verantwortliche (vgl. auch Art. 20 DSGVO);</li>
        <li>auf Beschwerde gegenüber der Aufsichtsbehörde, sofern sie der Ansicht sind, dass die sie betreffenden Daten durch den Anbieter unter Verstoss gegen datenschutzrechtliche Bestimmungen verarbeitet werden (vgl. auch Art. 77 DSGVO).</li>
      </ul>
      <p>
        Darüber hinaus ist der Anbieter dazu verpflichtet, alle Empfänger, denen gegenüber Daten durch den Anbieter
        offengelegt worden sind, über jedwede Berichtigung oder Löschung von Daten oder die Einschränkung der Verarbeitung,
        die aufgrund der Artikel 16, 17 Abs. 1, 18 DSGVO erfolgt, zu unterrichten. Diese Verpflichtung besteht jedoch
        nicht, soweit diese Mitteilung unmöglich oder mit einem unverhältnismässigen Aufwand verbunden ist. Unbeschadet
        dessen hat der Nutzer ein Recht auf Auskunft über diese Empfänger.
      </p>
      <p>
        Ebenfalls haben die Nutzer und Betroffenen nach Art. 21 DSGVO das Recht auf Widerspruch gegen die künftige
        Verarbeitung der sie betreffenden Daten, sofern die Daten durch den Anbieter nach Massgabe von Art. 6 Abs. 1 lit.
        f) DSGVO verarbeitet werden. Insbesondere ist ein Widerspruch gegen die Datenverarbeitung zum Zwecke der
        Direktwerbung statthaft.
      </p>

      <LegalH2 id="datenverarbeitung">III. Informationen zur Datenverarbeitung</LegalH2>
      <p>
        Ihre bei Nutzung unseres Internetauftritts verarbeiteten Daten werden gelöscht oder gesperrt, sobald der Zweck der
        Speicherung entfällt, der Löschung der Daten keine gesetzlichen Aufbewahrungspflichten entgegenstehen und
        nachfolgend keine anderslautenden Angaben zu einzelnen Verarbeitungsverfahren gemacht werden.
      </p>

      <LegalH3>Serverdaten</LegalH3>
      <p>
        Aus technischen Gründen, insbesondere zur Gewährleistung eines sicheren und stabilen Internetauftritts, werden
        Daten durch Ihren Internet-Browser an uns bzw. an unseren Webspace-Provider übermittelt. Mit diesen sog.
        Server-Logfiles werden u.a. Typ und Version Ihres Internetbrowsers, das Betriebssystem, die Website, von der aus
        Sie auf unseren Internetauftritt gewechselt haben (Referrer URL), die Website(s) unseres Internetauftritts, die Sie
        besuchen, Datum und Uhrzeit des jeweiligen Zugriffs sowie die IP-Adresse des Internetanschlusses, von dem aus die
        Nutzung unseres Internetauftritts erfolgt, erhoben.
      </p>
      <p>Diese so erhobenen Daten werden vorübergehend gespeichert, dies jedoch nicht gemeinsam mit anderen Daten von Ihnen.</p>
      <p>
        Diese Speicherung erfolgt auf der Rechtsgrundlage von Art. 6 Abs. 1 lit. f) DSGVO. Unser berechtigtes Interesse
        liegt in der Verbesserung, Stabilität, Funktionalität und Sicherheit unseres Internetauftritts.
      </p>
      <p>
        Die Daten werden spätestens nach sieben Tagen wieder gelöscht, soweit keine weitere Aufbewahrung zu Beweiszwecken
        erforderlich ist. Andernfalls sind die Daten bis zur endgültigen Klärung eines Vorfalls ganz oder teilweise von der
        Löschung ausgenommen.
      </p>

      <LegalH3>Cookies</LegalH3>
      <p><strong>a) Sitzungs-Cookies/Session-Cookies</strong></p>
      <p>
        Wir verwenden mit unserem Internetauftritt sog. Cookies. Cookies sind kleine Textdateien oder andere
        Speichertechnologien, die durch den von Ihnen eingesetzten Internet-Browser auf Ihrem Endgerät abgelegt und
        gespeichert werden. Durch diese Cookies werden im individuellen Umfang bestimmte Informationen von Ihnen, wie
        beispielsweise Ihre Browser- oder Standortdaten oder Ihre IP-Adresse, verarbeitet.
      </p>
      <p>
        Durch diese Verarbeitung wird unser Internetauftritt benutzerfreundlicher, effektiver und sicherer, da die
        Verarbeitung bspw. die Wiedergabe unseres Internetauftritts in unterschiedlichen Sprachen oder das Angebot einer
        Warenkorbfunktion ermöglicht.
      </p>
      <p>
        Rechtsgrundlage dieser Verarbeitung ist Art. 6 Abs. 1 lit. b) DSGVO, sofern diese Cookies Daten zur
        Vertragsanbahnung oder Vertragsabwicklung verarbeiten. Falls die Verarbeitung nicht der Vertragsanbahnung oder
        Vertragsabwicklung dient, liegt unser berechtigtes Interesse in der Verbesserung der Funktionalität unseres
        Internetauftritts. Rechtsgrundlage ist dann Art. 6 Abs. 1 lit. f) DSGVO. Mit Schliessen Ihres Internet-Browsers
        werden diese Session-Cookies gelöscht.
      </p>
      <p><strong>b) Drittanbieter-Cookies</strong></p>
      <p>
        Gegebenenfalls werden mit unserem Internetauftritt auch Cookies von Partnerunternehmen, mit denen wir zum Zwecke
        der Werbung, der Analyse oder der Funktionalitäten unseres Internetauftritts zusammenarbeiten, verwendet. Die
        Einzelheiten hierzu, insbesondere zu den Zwecken und den Rechtsgrundlagen der Verarbeitung solcher
        Drittanbieter-Cookies, entnehmen Sie bitte den nachfolgenden Informationen.
      </p>
      <p><strong>c) Beseitigungsmöglichkeit</strong></p>
      <p>
        Sie können die Installation der Cookies durch eine Einstellung Ihres Internet-Browsers verhindern oder
        einschränken. Ebenfalls können Sie bereits gespeicherte Cookies jederzeit löschen. Die hierfür erforderlichen
        Schritte und Massnahmen hängen jedoch von Ihrem konkret genutzten Internet-Browser ab. Bei Fragen benutzen Sie
        daher bitte die Hilfefunktion oder Dokumentation Ihres Internet-Browsers oder wenden sich an dessen Hersteller bzw.
        Support. Bei sog. Flash-Cookies kann die Verarbeitung allerdings nicht über die Einstellungen des Browsers
        unterbunden werden. Stattdessen müssen Sie insoweit die Einstellung Ihres Flash-Players ändern.
      </p>
      <p>
        Sollten Sie die Installation der Cookies verhindern oder einschränken, kann dies allerdings dazu führen, dass nicht
        sämtliche Funktionen unseres Internetauftritts vollumfänglich nutzbar sind.
      </p>

      <LegalH3>Vertragsabwicklung</LegalH3>
      <p>
        Die von Ihnen zur Inanspruchnahme unseres Waren- und/oder Dienstleistungsangebots übermittelten Daten werden von
        uns zum Zwecke der Vertragsabwicklung verarbeitet und sind insoweit erforderlich. Vertragsschluss und
        Vertragsabwicklung sind ohne Bereitstellung Ihrer Daten nicht möglich.
      </p>
      <p>
        Rechtsgrundlage für die Verarbeitung ist Art. 6 Abs. 1 lit. b) DSGVO. Wir löschen die Daten mit vollständiger
        Vertragsabwicklung, müssen dabei aber die steuer- und handelsrechtlichen Aufbewahrungsfristen beachten. Im Rahmen
        der Vertragsabwicklung geben wir Ihre Daten an das mit der Warenlieferung beauftragte Transportunternehmen oder an
        den Finanzdienstleister weiter, soweit die Weitergabe zur Warenauslieferung oder zu Bezahlzwecken erforderlich ist.
        Rechtsgrundlage für die Weitergabe der Daten ist dann Art. 6 Abs. 1 lit. b) DSGVO.
      </p>

      <LegalH3>Newsletter</LegalH3>
      <p>
        Falls Sie sich für unseren kostenlosen Newsletter anmelden, werden die von Ihnen hierzu abgefragten Daten, also
        Ihre E-Mail-Adresse sowie – optional – Ihr Name und Ihre Anschrift, an uns übermittelt. Gleichzeitig speichern wir
        die IP-Adresse des Internetanschlusses, von dem aus Sie auf unseren Internetauftritt zugreifen, sowie Datum und
        Uhrzeit Ihrer Anmeldung. Im Rahmen des weiteren Anmeldevorgangs werden wir Ihre Einwilligung in die Übersendung des
        Newsletters einholen, den Inhalt konkret beschreiben und auf diese Datenschutzerklärung verweisen. Die dabei
        erhobenen Daten verwenden wir ausschliesslich für den Newsletter-Versand – sie werden deshalb insbesondere auch
        nicht an Dritte weitergegeben.
      </p>
      <p>
        Rechtsgrundlage hierbei ist Art. 6 Abs. 1 lit. a) DSGVO. Die Einwilligung in den Newsletter-Versand können Sie
        gemäss Art. 7 Abs. 3 DSGVO jederzeit mit Wirkung für die Zukunft widerrufen. Hierzu müssen Sie uns lediglich über
        Ihren Widerruf in Kenntnis setzen oder den in jedem Newsletter enthaltenen Abmeldelink betätigen.
      </p>

      <LegalH3>Kontaktanfragen / Kontaktmöglichkeit</LegalH3>
      <p>
        Sofern Sie per Kontaktformular oder E-Mail mit uns in Kontakt treten, werden die dabei von Ihnen angegebenen Daten
        zur Bearbeitung Ihrer Anfrage genutzt. Die Angabe der Daten ist zur Bearbeitung und Beantwortung Ihrer Anfrage
        erforderlich – ohne deren Bereitstellung können wir Ihre Anfrage nicht oder allenfalls eingeschränkt beantworten.
      </p>
      <p>
        Rechtsgrundlage für diese Verarbeitung ist Art. 6 Abs. 1 lit. b) DSGVO. Ihre Daten werden gelöscht, sofern Ihre
        Anfrage abschliessend beantwortet worden ist und der Löschung keine gesetzlichen Aufbewahrungspflichten
        entgegenstehen, wie bspw. bei einer sich etwaig anschliessenden Vertragsabwicklung.
      </p>

      <LegalH3>Nutzung von Microsoft 365 Anwendungen</LegalH3>
      <p>
        Wir nutzen Microsoft 365 für Dienste wie Microsoft Teams, Exchange Online und SharePoint. Im Rahmen dieser Nutzung
        haben wir einen Vertrag zur Auftragsdatenverarbeitung mit Microsoft. Microsoft bietet einen hohen Standard an
        Datenschutz und Datensicherheit.
      </p>
      <p>
        Die Nutzung von Microsoft 365 Anwendungen wie Teams, OneDrive for Business, SharePoint Online, Stream, Forms
        erfolgt in Zusammenarbeit mit der Faltin Travel AG. Bei der Nutzung der M365 werden personenbezogene Daten über
        Sie verarbeitet. Weitere Informationen zur Datenverarbeitung durch Microsoft finden Sie unter:{' '}
        <A href="https://privacy.microsoft.com/de-de/privacystatement">https://privacy.microsoft.com/de-de/privacystatement</A>
      </p>
      <p>
        Die administrative Betreuung unseres Tenants erfolgt durch die Sunrise GmbH, mit Sitz in Opfikon, Schweiz, mit der
        wir einen Vertrag abgeschlossen haben. Microsoft 365 ist eine Plattform für Produktivität, Kollaboration und
        Informationsaustausch, die auch organisationseinheitenübergreifend genutzt werden kann. Die Nutzung von Microsoft
        365 führt zur Verarbeitung personenbezogener Daten.
      </p>
      <p>
        Beachten Sie bitte, dass die Verwendung von Microsoft 365 Anwendungen die Übertragung Ihrer personenbezogenen Daten
        an Microsoft und möglicherweise auch die Speicherung dieser Daten auf Servern in den USA bedeutet. Wir haben mit
        Microsoft eine Vereinbarung zur Auftragsverarbeitung nach Art. 28 DSGVO geschlossen, um sicherzustellen, dass Ihre
        Daten sicher und in Übereinstimmung mit den geltenden Datenschutzgesetzen verarbeitet werden. Die Verarbeitung
        Ihrer Daten im Zusammenhang mit der Nutzung von Microsoft 365 Anwendungen erfolgt auf Grundlage von Art. 6 Abs. 1
        lit. f) DSGVO. Unser berechtigtes Interesse liegt in der effizienten und sicheren Bereitstellung unserer
        Dienstleistungen und der Zusammenarbeit mit unseren Kunden und Partnern.
      </p>
      <p>
        <strong>Verarbeitung und Übertragung von Daten:</strong> Bei der Nutzung von Microsoft 365 werden automatisch
        bestimmte Informationen verarbeitet. Dazu gehören Ihre IP-Adresse, Ihr Benutzername, Daten im Rahmen der
        Multifaktor-Authentifizierung, die Sie in Ihrem Microsoft-Konto hinterlegt haben (z. B. optional die Handynummer),
        und andere Informationen, die Sie als Nutzer, Absender und Empfänger von Daten innerhalb von Microsoft 365
        kennzeichnen. Ihre personenbezogenen Daten werden nur dann an Dritte weitergegeben, wenn dies gesetzlich zulässig
        bzw. erforderlich ist.
      </p>

      <LegalH3>Google Analytics</LegalH3>
      <p>
        In unserem Internetauftritt setzen wir Google Analytics ein. Hierbei handelt es sich um einen Webanalysedienst der
        Google LLC, 1600 Amphitheatre Parkway, Mountain View, CA 94043 USA, nachfolgend nur „Google" genannt. Der Dienst
        Google Analytics dient zur Analyse des Nutzungsverhaltens unseres Internetauftritts. Rechtsgrundlage ist Art. 6
        Abs. 1 lit. f) DSGVO. Unser berechtigtes Interesse liegt in der Analyse, Optimierung und dem wirtschaftlichen
        Betrieb unseres Internetauftritts.
      </p>
      <p>
        Nutzungs- und nutzerbezogene Informationen, wie bspw. IP-Adresse, Ort, Zeit oder Häufigkeit des Besuchs unseres
        Internetauftritts, werden dabei an einen Server von Google in den USA übertragen und dort gespeichert. Allerdings
        nutzen wir Google Analytics mit der sog. Anonymisierungsfunktion. Durch diese Funktion kürzt Google die IP-Adresse
        schon innerhalb der EU bzw. des EWR.
      </p>
      <p>
        Google bietet unter{' '}
        <A href="https://tools.google.com/dlpage/gaoptout?hl=de">https://tools.google.com/dlpage/gaoptout?hl=de</A>{' '}
        ein sog. Deaktivierungs-Add-on nebst weiteren Informationen hierzu an. Weitere datenschutzrechtliche Informationen
        finden Sie unter{' '}
        <A href="https://policies.google.com/privacy">https://policies.google.com/privacy</A>.
      </p>

      <LegalH3>Google reCAPTCHA</LegalH3>
      <p>
        In unserem Internetauftritt setzen wir Google reCAPTCHA zur Überprüfung und Vermeidung von Interaktionen auf
        unserer Internetseite durch automatisierte Zugriffe, bspw. durch sog. Bots, ein. Es handelt sich hierbei um einen
        Dienst der Google LLC. Durch diesen Dienst kann Google ermitteln, von welcher Webseite eine Anfrage gesendet wird
        sowie von welcher IP-Adresse aus Sie die sog. reCAPTCHA-Eingabebox verwenden. Rechtsgrundlage ist Art. 6 Abs. 1
        lit. f) DSGVO. Unser berechtigtes Interesse liegt in der Sicherheit unseres Internetauftritts sowie in der Abwehr
        unerwünschter, automatisierter Zugriffe in Form von Spam o. ä. Weitere Informationen unter{' '}
        <A href="https://policies.google.com/privacy">https://policies.google.com/privacy</A>.
      </p>

      <LegalH3>Google Fonts</LegalH3>
      <p>
        In unserem Internetauftritt setzen wir Google Fonts zur Darstellung externer Schriftarten ein. Es handelt sich
        hierbei um einen Dienst der Google LLC. Um die Darstellung bestimmter Schriften in unserem Internetauftritt zu
        ermöglichen, wird bei Aufruf unseres Internetauftritts eine Verbindung zu dem Google-Server in den USA aufgebaut.
        Rechtsgrundlage ist Art. 6 Abs. 1 lit. f) DSGVO. Unser berechtigtes Interesse liegt in der Optimierung und dem
        wirtschaftlichen Betrieb unseres Internetauftritts. Weitere Informationen unter{' '}
        <A href="https://policies.google.com/privacy">https://policies.google.com/privacy</A>.
      </p>

      <LegalH3>Ihre Rechte</LegalH3>
      <p>
        (1) Sie haben das Recht, von uns jederzeit eine Bestätigung darüber zu verlangen, ob die betreffenden Daten von uns
        verarbeitet werden. Ist dies der Fall, so haben Sie das Recht auf Auskunft über diese Daten sowie auf Berichtigung
        oder Löschung der Daten, Einschränkung und Widerspruch der Verarbeitung und auf Datenübertragbarkeit.
      </p>
      <p>
        (2) Falls Sie eine Einwilligung zur Verarbeitung Ihrer Daten erteilt haben, können Sie diese jederzeit widerrufen.
        Ein solcher Widerruf beeinflusst die Zulässigkeit der Verarbeitung Ihrer personenbezogenen Daten, nachdem Sie ihn
        gegenüber uns ausgesprochen haben.
      </p>
      <p>
        (3) Selbstverständlich können Sie der Verarbeitung Ihrer personenbezogenen Daten für Zwecke der Werbung und
        Datenanalyse jederzeit widersprechen.
      </p>
    </LegalPage>
  );
}
