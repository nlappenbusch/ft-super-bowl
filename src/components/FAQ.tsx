'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: 'Was ist im Hospitality-Package enthalten?',
    answer: 'Unser offizielles Super Bowl Hospitality-Package beinhaltet: Zutritt zum Stadion über einen separaten VIP-Eingang, Zutritt zur offiziellen Super Bowl Pregame-Party, Catering & Getränke im Hospitality-Bereich, Live-Entertainment, reservierte Sitzplätze im 500er Level sowie ein personalisiertes Super Bowl Präsent.'
  },
  {
    question: 'Wo befindet sich das Dream Hollywood Hotel?',
    answer: 'Das Dream Hollywood, by Hyatt befindet sich im Herzen von Hollywood (6417 Selma Avenue). Es liegt nur 18 km vom SoFi Stadium, 24 km vom Los Angeles International Airport entfernt und fußläufig zum Hollywood Walk of Fame.'
  },
  {
    question: 'Sind die Sitzplätze nebeneinander?',
    answer: 'Ja, alle Tickets einer Buchung befinden sich im gleichen reservierten Block im 500er Level des SoFi Stadiums.'
  },
  {
    question: 'Wie hoch ist der Einzelzimmer-Zuschlag?',
    answer: 'Der Einzelzimmer-Zuschlag beträgt 1.485,- Euro zusätzlich zum Basispreis.'
  },
  {
    question: 'Ist die Anreise im Preis enthalten?',
    answer: 'Nein, die Anreise nach Los Angeles ist nicht im Paketpreis enthalten. Gerne beraten wir Sie bei der Flugbuchung und helfen bei der Organisation.'
  },
  {
    question: 'Welche Leistungen sind inklusive?',
    answer: '4 Übernachtungen im Dream Hollywood (12.-16. Februar 2027), Hospitality-Ticket im 500er Level, Pregame-Party mit Catering, VIP-Eingang, Los Angeles Reiseführer, personalisiertes Super Bowl Präsent, Ticket-Lanyard, Tickettasche, Reisebeutel, Kofferanhänger, detaillierte Reiseinformation und Schweizer Reisegarantie.'
  },
  {
    question: 'Wie kann ich bezahlen?',
    answer: 'Wir akzeptieren Überweisungen in CHF und EUR. Bankverbindung: UBS, BIC: UBSWCHZH80A, IBAN CHF: CH85 0029 1291 1135 1801 R, IBAN EUR: CH65 0029 1291 1135 1860 G.'
  }
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {faqData.map((item, index) => (
        <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition text-left"
          >
            <span className="font-semibold text-gray-900">{item.question}</span>
            <ChevronDown 
              className={`w-5 h-5 text-gray-500 transition-transform ${openIndex === index ? 'rotate-180' : ''}`} 
            />
          </button>
          {openIndex === index && (
            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <p className="text-gray-700">{item.answer}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
