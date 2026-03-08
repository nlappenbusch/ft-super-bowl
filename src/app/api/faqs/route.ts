import { NextResponse } from 'next/server';
import { DEFAULT_EVENT_SLUG, getEventFaqs } from '@/lib/eventData';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventSlug = searchParams.get('event') || DEFAULT_EVENT_SLUG;

  const staticFaqs = [
    {
      question: "Was ist im Hospitality-Package enthalten?",
      answer: "Das Hospitality-Package beinhaltet ein Premium-Ticket im 500er Level mit exklusivem Zugang zur Pregame-Party, VIP-Eingang zum Stadion, Premium-Catering, Getränke und Live-Entertainment im Hospitality-Bereich vor dem Spiel."
    },
    {
      question: "Wo befindet sich das Dream Hollywood Hotel?",
      answer: "Das Dream Hollywood Hotel liegt im Herzen von Hollywood, nur wenige Minuten vom Hollywood Walk of Fame entfernt. Es verfügt über einen Rooftop-Pool mit Blick auf das berühmte Hollywood Sign und bietet modernes Design mit erstklassigem Service."
    },
    {
      question: "Sind die Sitzplätze nebeneinander?",
      answer: "Wir bemühen uns, zusammenhängende Sitzplätze zu reservieren. Bei frühzeitiger Buchung können wir dies in der Regel garantieren. Die finale Sitzplatzzuteilung erfolgt durch die NFL etwa 4-6 Wochen vor dem Event."
    },
    {
      question: "Wie hoch ist der Einzelzimmer-Zuschlag?",
      answer: "Der Einzelzimmer-Zuschlag beträgt 1.485 € pro Person für den gesamten Aufenthalt (4 Nächte). Dieser wird zum Grundpreis von 8.950 € hinzugerechnet, sodass der Gesamtpreis bei 10.435 € pro Person im Einzelzimmer liegt."
    },
    {
      question: "Ist die Anreise im Preis enthalten?",
      answer: "Die Flüge sind nicht im Package-Preis enthalten, können aber gerne über uns gebucht werden. Wir organisieren auf Wunsch Gruppenflüge zu attraktiven Konditionen und kümmern uns um alle Transfers zwischen Flughafen, Hotel und Stadion."
    },
    {
      question: "Welche Leistungen sind inklusive?",
      answer: "Im Preis enthalten sind: 4 Übernachtungen im Dream Hollywood Hotel, Hospitality-Ticket für den Super Bowl LXI, Zugang zur Pregame-Party mit Catering & Getränken, VIP-Eingang, Live-Entertainment, Reiseführer, personalisiertes Super Bowl Präsent, Tickettasche, Lanyard und Schweizer Reisegarantie."
    },
    {
      question: "Wie kann ich bezahlen?",
      answer: "Nach Ihrer Anfrage erhalten Sie von uns ein individuelles Angebot. Die Zahlung erfolgt per Banküberweisung in Raten: 25% Anzahlung bei Buchung, 50% bis 90 Tage vor Reisebeginn, Restbetrag 30 Tage vor Abreise. Alle Zahlungen sind durch die Schweizer Reisegarantie abgesichert."
    }
  ];

  const eventFaqs = await getEventFaqs(eventSlug);
  const faqs = eventFaqs.length > 0
    ? eventFaqs.map((faq) => ({ question: faq.question, answer: faq.answer }))
    : staticFaqs;

  // HTML für FAQs
  const html = `
    <div class="superbowl-faqs" style="max-width: 800px; margin: 0 auto;">
      <h2 style="font-size: 32px; font-weight: bold; color: #184a7b; margin-bottom: 32px; text-align: center;">
        Häufig gestellte Fragen
      </h2>
      
      <div class="faq-list" style="display: flex; flex-direction: column; gap: 16px;">
        ${faqs.map((faq, index) => `
          <div class="faq-item" style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <button 
              class="faq-question" 
              data-faq-index="${index}"
              style="width: 100%; padding: 20px; text-align: left; background: white; border: none; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 16px; font-weight: 600; color: #184a7b; transition: background 0.2s;"
              onmouseover="this.style.background='#f8f9fa'"
              onmouseout="this.style.background='white'"
              onclick="toggleFAQ(${index})"
            >
              <span>${faq.question}</span>
              <svg class="faq-icon" id="faq-icon-${index}" style="width: 20px; height: 20px; transition: transform 0.3s;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>
            <div 
              class="faq-answer" 
              id="faq-answer-${index}"
              style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out; background: #f8f9fa;"
            >
              <div style="padding: 20px; color: #666; line-height: 1.6;">
                ${faq.answer}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    
    <script>
      function toggleFAQ(index) {
        const answer = document.getElementById('faq-answer-' + index);
        const icon = document.getElementById('faq-icon-' + index);
        
        if (answer.style.maxHeight && answer.style.maxHeight !== '0px') {
          answer.style.maxHeight = '0';
          icon.style.transform = 'rotate(0deg)';
        } else {
          // Alle anderen schließen
          document.querySelectorAll('.faq-answer').forEach((el, i) => {
            if (i !== index) {
              el.style.maxHeight = '0';
              document.getElementById('faq-icon-' + i).style.transform = 'rotate(0deg)';
            }
          });
          
          answer.style.maxHeight = answer.scrollHeight + 'px';
          icon.style.transform = 'rotate(180deg)';
        }
      }
    </script>
    
    <!-- Schema.org FAQ -->
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": ${JSON.stringify(faqs.map(faq => ({
          "@type": "Question",
          "name": faq.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": faq.answer
          }
        })))}
      }
    </script>
  `;

  return NextResponse.json({
    success: true,
    data: faqs,
    html: html
  });
}
