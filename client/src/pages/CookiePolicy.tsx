import { useLocation } from 'wouter';

export default function CookiePolicy() {
  const [, setLocation] = useLocation();

  return (
    <div style={{ minHeight: '100vh', background: '#ffe5e5', padding: '2rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', background: 'white', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <button
          onClick={() => setLocation('/')}
          style={{
            marginBottom: '2rem',
            padding: '0.5rem 1rem',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          ← Torna alla Home
        </button>

        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', color: '#e63946' }}>
          Cookie Policy
        </h1>
        
        <p style={{ marginBottom: '1rem', color: '#666', fontSize: '0.9rem' }}>
          <strong>Data ultimo aggiornamento:</strong> 02 Febbraio 2026
        </p>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#333' }}>
            1. Cosa sono i Cookie
          </h2>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            I cookie sono piccoli file di testo che vengono memorizzati sul tuo dispositivo (computer, tablet, smartphone) quando visiti un sito web. I cookie permettono al sito di riconoscere il tuo dispositivo e memorizzare informazioni sulle tue preferenze o azioni passate, migliorando la tua esperienza di navigazione.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#333' }}>
            2. Tipologie di Cookie Utilizzati
          </h2>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            Il sito <strong>KickOff-trivia.com</strong> utilizza le seguenti categorie di cookie:
          </p>

          <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '1.5rem', marginBottom: '0.5rem', color: '#444' }}>
            2.1 Cookie Tecnici (Necessari)
          </h3>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            Questi cookie sono essenziali per il corretto funzionamento del sito e non possono essere disattivati. Vengono utilizzati per:
          </p>
          <ul style={{ marginLeft: '2rem', marginBottom: '1rem', lineHeight: '1.8', color: '#555' }}>
            <li>Gestire la sessione di navigazione</li>
            <li>Memorizzare le preferenze sui cookie</li>
            <li>Garantire la sicurezza del sito</li>
          </ul>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            <strong>Base giuridica:</strong> Interesse legittimo (Art. 6(1)(f) GDPR)<br />
            <strong>Durata:</strong> Sessione o fino a 12 mesi<br />
            <strong>Consenso richiesto:</strong> No (cookie tecnici essenziali)
          </p>

          <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '1.5rem', marginBottom: '0.5rem', color: '#444' }}>
            2.2 Cookie di Statistica (Analitici)
          </h3>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            Questi cookie ci aiutano a comprendere come i visitatori interagiscono con il sito, raccogliendo informazioni in forma anonima. Utilizziamo questi dati per:
          </p>
          <ul style={{ marginLeft: '2rem', marginBottom: '1rem', lineHeight: '1.8', color: '#555' }}>
            <li>Analizzare il traffico e le pagine più visitate</li>
            <li>Migliorare l'esperienza utente</li>
            <li>Identificare problemi tecnici</li>
          </ul>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            <strong>Servizi utilizzati:</strong> Google Analytics (o servizi simili)<br />
            <strong>Base giuridica:</strong> Consenso (Art. 6(1)(a) GDPR)<br />
            <strong>Durata:</strong> Fino a 24 mesi<br />
            <strong>Consenso richiesto:</strong> Sì
          </p>

          <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '1.5rem', marginBottom: '0.5rem', color: '#444' }}>
            2.3 Cookie di Marketing (Pubblicitari)
          </h3>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            Questi cookie sono utilizzati per mostrare annunci pubblicitari pertinenti ai tuoi interessi. Possono essere impostati da noi o da partner pubblicitari terzi (es. Google AdSense). Questi cookie:
          </p>
          <ul style={{ marginLeft: '2rem', marginBottom: '1rem', lineHeight: '1.8', color: '#555' }}>
            <li>Tracciano le tue abitudini di navigazione</li>
            <li>Creano un profilo dei tuoi interessi</li>
            <li>Mostrano annunci personalizzati</li>
            <li>Misurano l'efficacia delle campagne pubblicitarie</li>
          </ul>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            <strong>Servizi utilizzati:</strong> Google AdSense<br />
            <strong>Base giuridica:</strong> Consenso (Art. 6(1)(a) GDPR)<br />
            <strong>Durata:</strong> Fino a 24 mesi<br />
            <strong>Consenso richiesto:</strong> Sì
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#333' }}>
            3. Cookie di Terze Parti
          </h2>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            Il sito utilizza cookie di terze parti per fornire servizi di analisi e pubblicità:
          </p>
          <ul style={{ marginLeft: '2rem', marginBottom: '1rem', lineHeight: '1.8', color: '#555' }}>
            <li><strong>Google Analytics:</strong> per analizzare il traffico del sito. <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#667eea', textDecoration: 'underline' }}>Privacy Policy Google</a></li>
            <li><strong>Google AdSense:</strong> per mostrare annunci pubblicitari personalizzati. <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer" style={{ color: '#667eea', textDecoration: 'underline' }}>Informazioni sulla pubblicità Google</a></li>
          </ul>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            Non abbiamo controllo sui cookie impostati da terze parti. Ti invitiamo a consultare le rispettive privacy policy per maggiori informazioni.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#333' }}>
            4. Gestione delle Preferenze sui Cookie
          </h2>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            Puoi gestire le tue preferenze sui cookie in qualsiasi momento tramite:
          </p>
          <ul style={{ marginLeft: '2rem', marginBottom: '1rem', lineHeight: '1.8', color: '#555' }}>
            <li><strong>Banner cookie:</strong> alla prima visita del sito, puoi scegliere quali categorie di cookie accettare.</li>
            <li><strong>Impostazioni del browser:</strong> puoi bloccare o eliminare i cookie dalle impostazioni del tuo browser (vedi sezione 5).</li>
          </ul>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            <strong>Nota:</strong> Il rifiuto dei cookie tecnici potrebbe compromettere il corretto funzionamento del sito.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#333' }}>
            5. Come Disabilitare i Cookie dal Browser
          </h2>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            Puoi disabilitare i cookie direttamente dalle impostazioni del tuo browser. Ecco i link alle guide ufficiali dei browser più comuni:
          </p>
          <ul style={{ marginLeft: '2rem', marginBottom: '1rem', lineHeight: '1.8', color: '#555' }}>
            <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" style={{ color: '#667eea', textDecoration: 'underline' }}>Google Chrome</a></li>
            <li><a href="https://support.mozilla.org/it/kb/Gestione%20dei%20cookie" target="_blank" rel="noopener noreferrer" style={{ color: '#667eea', textDecoration: 'underline' }}>Mozilla Firefox</a></li>
            <li><a href="https://support.apple.com/it-it/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer" style={{ color: '#667eea', textDecoration: 'underline' }}>Safari</a></li>
            <li><a href="https://support.microsoft.com/it-it/microsoft-edge/eliminare-i-cookie-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" style={{ color: '#667eea', textDecoration: 'underline' }}>Microsoft Edge</a></li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#333' }}>
            6. Opt-Out dalla Pubblicità Personalizzata
          </h2>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            Puoi disattivare la pubblicità personalizzata di Google tramite:
          </p>
          <ul style={{ marginLeft: '2rem', marginBottom: '1rem', lineHeight: '1.8', color: '#555' }}>
            <li><a href="https://adssettings.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#667eea', textDecoration: 'underline' }}>Impostazioni annunci Google</a></li>
            <li><a href="https://www.youronlinechoices.com/it/" target="_blank" rel="noopener noreferrer" style={{ color: '#667eea', textDecoration: 'underline' }}>Your Online Choices</a> (per opt-out da più network pubblicitari)</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#333' }}>
            7. Durata dei Cookie
          </h2>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            I cookie utilizzati sul sito hanno le seguenti durate:
          </p>
          <ul style={{ marginLeft: '2rem', marginBottom: '1rem', lineHeight: '1.8', color: '#555' }}>
            <li><strong>Cookie di sessione:</strong> vengono eliminati automaticamente alla chiusura del browser.</li>
            <li><strong>Cookie persistenti:</strong> rimangono sul dispositivo fino alla scadenza (massimo 24 mesi) o fino alla loro eliminazione manuale.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#333' }}>
            8. Modifiche alla Cookie Policy
          </h2>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            Ci riserviamo il diritto di modificare la presente Cookie Policy in qualsiasi momento. Le modifiche saranno pubblicate su questa pagina con indicazione della data di ultimo aggiornamento. Ti invitiamo a consultare periodicamente questa pagina per rimanere informato.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#333' }}>
            9. Contatti
          </h2>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            Per qualsiasi domanda o richiesta relativa alla presente Cookie Policy, puoi contattarci tramite il modulo di feedback presente sul Sito.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#333' }}>
            10. Riferimenti Normativi
          </h2>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            La presente Cookie Policy è redatta in conformità con:
          </p>
          <ul style={{ marginLeft: '2rem', marginBottom: '1rem', lineHeight: '1.8', color: '#555' }}>
            <li>Regolamento (UE) 2016/679 (GDPR)</li>
            <li>Direttiva 2002/58/CE (ePrivacy)</li>
            <li>D.Lgs. 196/2003 (Codice Privacy italiano) come modificato dal D.Lgs. 101/2018</li>
            <li>Linee guida del Garante per la Protezione dei Dati Personali</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
