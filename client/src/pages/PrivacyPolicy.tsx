import { useLocation } from 'wouter';

export default function PrivacyPolicy() {
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
          Privacy Policy
        </h1>
        
        <p style={{ marginBottom: '1rem', color: '#666', fontSize: '0.9rem' }}>
          <strong>Data ultimo aggiornamento:</strong> 02 Febbraio 2026
        </p>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#333' }}>
            1. Introduzione
          </h2>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            La presente Privacy Policy descrive come KickOff Trivia ("noi", "nostro") raccoglie, utilizza e protegge i dati personali degli utenti ("tu", "tuo") che visitano e utilizzano il sito web <strong>KickOff Trivia</strong> (il "Sito"). Ci impegniamo a proteggere la tua privacy in conformità con il Regolamento Generale sulla Protezione dei Dati (GDPR - Regolamento UE 2016/679) e la normativa italiana applicabile.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#333' }}>
            2. Titolare del Trattamento
          </h2>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            Il Titolare del trattamento dei dati personali è:<br />
            <strong>KickOff Italia</strong><br />
            Per qualsiasi richiesta relativa al trattamento dei tuoi dati personali, puoi contattarci tramite il modulo di feedback presente sul Sito.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#333' }}>
            3. Dati Raccolti
          </h2>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            Il Sito raccoglie le seguenti categorie di dati:
          </p>
          <ul style={{ marginLeft: '2rem', marginBottom: '1rem', lineHeight: '1.8', color: '#555' }}>
            <li><strong>Dati di navigazione:</strong> indirizzo IP, tipo di browser, sistema operativo, pagine visitate, durata della sessione, riferimenti di provenienza (tramite cookie tecnici e di analisi).</li>
            <li><strong>Dati forniti volontariamente:</strong> nome utente e punteggi quando salvi i tuoi risultati nelle classifiche dei giochi.</li>
            <li><strong>Dati di feedback:</strong> informazioni fornite volontariamente tramite il modulo di feedback.</li>
          </ul>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            <strong>Non raccogliamo dati sensibili</strong> (es. origine etnica, opinioni politiche, dati biometrici, dati sanitari) né dati relativi a minori di 16 anni senza il consenso dei genitori o tutori legali.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#333' }}>
            4. Finalità e Base Giuridica del Trattamento
          </h2>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            I tuoi dati personali sono trattati per le seguenti finalità:
          </p>
          <ul style={{ marginLeft: '2rem', marginBottom: '1rem', lineHeight: '1.8', color: '#555' }}>
            <li><strong>Funzionamento del Sito (cookie tecnici):</strong> garantire il corretto funzionamento del Sito e delle sue funzionalità (base giuridica: interesse legittimo - Art. 6(1)(f) GDPR).</li>
            <li><strong>Classifiche e punteggi:</strong> salvare e visualizzare i punteggi degli utenti nelle classifiche dei giochi (base giuridica: consenso - Art. 6(1)(a) GDPR).</li>
            <li><strong>Analisi statistiche (cookie di statistica):</strong> analizzare l'utilizzo del Sito per migliorare l'esperienza utente (base giuridica: consenso - Art. 6(1)(a) GDPR).</li>
            <li><strong>Pubblicità personalizzata (cookie di marketing):</strong> mostrare annunci pubblicitari pertinenti tramite Google AdSense (base giuridica: consenso - Art. 6(1)(a) GDPR).</li>
            <li><strong>Gestione feedback:</strong> rispondere alle richieste inviate tramite il modulo di feedback (base giuridica: interesse legittimo - Art. 6(1)(f) GDPR).</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#333' }}>
            5. Modalità di Trattamento
          </h2>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            I dati personali sono trattati con strumenti elettronici e manuali, adottando misure di sicurezza tecniche e organizzative adeguate per prevenire accessi non autorizzati, perdita, distruzione o divulgazione non autorizzata. L'accesso ai dati è limitato al personale autorizzato e ai fornitori di servizi terzi che operano come responsabili del trattamento.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#333' }}>
            6. Condivisione dei Dati
          </h2>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            I tuoi dati personali possono essere condivisi con:
          </p>
          <ul style={{ marginLeft: '2rem', marginBottom: '1rem', lineHeight: '1.8', color: '#555' }}>
            <li><strong>Google AdSense:</strong> per la pubblicazione di annunci pubblicitari (solo previo tuo consenso).</li>
            <li><strong>Fornitori di servizi di hosting e infrastruttura:</strong> per garantire il funzionamento del Sito.</li>
            <li><strong>Autorità competenti:</strong> quando richiesto dalla legge o per proteggere i nostri diritti legali.</li>
          </ul>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            <strong>Non vendiamo né cediamo i tuoi dati personali a terzi per finalità commerciali.</strong>
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#333' }}>
            7. Trasferimento dei Dati all'Estero
          </h2>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            Alcuni fornitori di servizi (es. Google AdSense) possono trasferire i tuoi dati al di fuori dello Spazio Economico Europeo (SEE). In tal caso, garantiamo che il trasferimento avvenga in conformità con il GDPR, mediante l'adozione di clausole contrattuali standard approvate dalla Commissione Europea o altri meccanismi di garanzia adeguati.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#333' }}>
            8. Periodo di Conservazione
          </h2>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            I dati personali sono conservati per il tempo strettamente necessario alle finalità per cui sono stati raccolti:
          </p>
          <ul style={{ marginLeft: '2rem', marginBottom: '1rem', lineHeight: '1.8', color: '#555' }}>
            <li><strong>Cookie tecnici:</strong> durata della sessione o fino a 12 mesi.</li>
            <li><strong>Cookie di statistica e marketing:</strong> fino a 24 mesi o fino alla revoca del consenso.</li>
            <li><strong>Punteggi e classifiche:</strong> fino alla richiesta di cancellazione da parte dell'utente.</li>
            <li><strong>Feedback:</strong> fino a 24 mesi dalla ricezione.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#333' }}>
            9. Diritti dell'Interessato
          </h2>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            In conformità con il GDPR, hai i seguenti diritti:
          </p>
          <ul style={{ marginLeft: '2rem', marginBottom: '1rem', lineHeight: '1.8', color: '#555' }}>
            <li><strong>Diritto di accesso (Art. 15):</strong> ottenere conferma dell'esistenza dei tuoi dati e riceverne copia.</li>
            <li><strong>Diritto di rettifica (Art. 16):</strong> correggere dati inesatti o incompleti.</li>
            <li><strong>Diritto alla cancellazione (Art. 17):</strong> richiedere la cancellazione dei tuoi dati ("diritto all'oblio").</li>
            <li><strong>Diritto di limitazione (Art. 18):</strong> limitare il trattamento in determinate circostanze.</li>
            <li><strong>Diritto alla portabilità (Art. 20):</strong> ricevere i tuoi dati in formato strutturato e trasferirli a un altro titolare.</li>
            <li><strong>Diritto di opposizione (Art. 21):</strong> opporti al trattamento basato su interesse legittimo.</li>
            <li><strong>Diritto di revoca del consenso (Art. 7(3)):</strong> revocare il consenso in qualsiasi momento (senza pregiudicare la liceità del trattamento precedente).</li>
          </ul>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            Per esercitare i tuoi diritti, contattaci tramite il modulo di feedback presente sul Sito. Risponderemo entro 30 giorni dalla richiesta.
          </p>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            Hai inoltre il diritto di proporre reclamo all'Autorità Garante per la Protezione dei Dati Personali (www.garanteprivacy.it) se ritieni che il trattamento dei tuoi dati violi il GDPR.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#333' }}>
            10. Sicurezza dei Dati
          </h2>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            Adottiamo misure di sicurezza tecniche e organizzative appropriate per proteggere i tuoi dati personali da accessi non autorizzati, perdita, distruzione o alterazione, tra cui:
          </p>
          <ul style={{ marginLeft: '2rem', marginBottom: '1rem', lineHeight: '1.8', color: '#555' }}>
            <li>Crittografia dei dati in transito (HTTPS).</li>
            <li>Controllo degli accessi e autenticazione.</li>
            <li>Monitoraggio e audit regolari dei sistemi.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#333' }}>
            11. Modifiche alla Privacy Policy
          </h2>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            Ci riserviamo il diritto di modificare la presente Privacy Policy in qualsiasi momento. Le modifiche saranno pubblicate su questa pagina con indicazione della data di ultimo aggiornamento. Ti invitiamo a consultare periodicamente questa pagina per rimanere informato sulle nostre pratiche di trattamento dei dati.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#333' }}>
            12. Contatti
          </h2>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#555' }}>
            Per qualsiasi domanda o richiesta relativa alla presente Privacy Policy o al trattamento dei tuoi dati personali, puoi contattarci tramite il modulo di feedback presente sul Sito.
          </p>
        </section>
      </div>
    </div>
  );
}
