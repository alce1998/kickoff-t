import { useState } from 'react';
import { useLocation } from 'wouter';
import { NavigationBar } from '@/components/NavigationBar';
import { FeedbackModal } from '@/components/FeedbackModal';
import { DonationProgress } from '@/components/DonationProgress';
import { HelpCircle, Trophy, Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useTranslation } from 'react-i18next';

export default function AaronsZurkowskiSetup() {
  const [, setLocation] = useLocation();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [players, setPlayers] = useState<string[]>(['Giocatore 1', 'Giocatore 2']);
  const [newPlayerName, setNewPlayerName] = useState('');
  const { t } = useTranslation();

  const addPlayer = () => {
    if (players.length >= 8) return;
    const name = newPlayerName.trim() || `Giocatore ${players.length + 1}`;
    setPlayers([...players, name]);
    setNewPlayerName('');
  };

  const removePlayer = (index: number) => {
    if (players.length <= 1) return;
    setPlayers(players.filter((_, i) => i !== index));
  };

  const updatePlayerName = (index: number, name: string) => {
    const updated = [...players];
    updated[index] = name;
    setPlayers(updated);
  };

  const startGame = () => {
    const encoded = encodeURIComponent(JSON.stringify(players));
    setLocation(`/aarons-zurkowski/gioco?players=${encoded}`);
  };

  return (
    <>
      <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />

      <div className="min-h-screen bg-background text-foreground p-4 font-mono">
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 mb-8">

            {/* Titolo */}
            <h1 className="text-4xl font-display font-bold uppercase text-center mb-2 text-primary">
              AARONS-ŻURKOWSKI
            </h1>
            <p className="text-center text-muted-foreground mb-6 font-bold uppercase tracking-widest text-sm">
              {t('az.sottotitolo', 'Indovina il cognome del calciatore misterioso')}
            </p>

            {/* Come si gioca */}
            <div className="border-t-4 border-black pt-6">
              <button
                onClick={() => setIsHowToPlayOpen(!isHowToPlayOpen)}
                className="w-full text-left"
              >
                <h2 className="text-2xl font-display font-bold uppercase mb-4 flex items-center gap-2 hover:text-primary transition-colors cursor-pointer">
                  <HelpCircle className="h-6 w-6" />
                  {t('setup.comeSiGioca')}
                  <span className="ml-auto text-xl">{isHowToPlayOpen ? '▲' : '▼'}</span>
                </h2>
              </button>

              {isHowToPlayOpen && (
                <div className="space-y-4 text-sm mb-6">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">1</div>
                    <div>
                      <h3 className="font-bold uppercase">{t('az.step1Titolo', 'Il calciatore misterioso')}</h3>
                      <p className="text-muted-foreground">{t('az.step1Desc', 'Il sistema estrae un calciatore casuale dal database Serie A 2000-2027. Il suo cognome è nascosto e deve essere indovinato.')}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">2</div>
                    <div>
                      <h3 className="font-bold uppercase">{t('az.step2Titolo', 'Il range alfabetico')}</h3>
                      <p className="text-muted-foreground">{t('az.step2Desc', 'Il cognome si trova tra "Aarons" e "Żurkowski". Inserisci un cognome presente nel database: se è prima del calciatore misterioso diventa il nuovo limite basso, se è dopo diventa il nuovo limite alto.')}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">3</div>
                    <div>
                      <h3 className="font-bold uppercase">{t('az.step3Titolo', 'Restringi il range')}</h3>
                      <p className="text-muted-foreground">{t('az.step3Desc', 'Ad ogni tentativo il range si restringe. Cognomi fuori dal range corrente non vengono accettati. Solo cognomi presenti nel database sono validi.')}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">4</div>
                    <div>
                      <h3 className="font-bold uppercase">{t('az.step4Titolo', 'Vittoria o resa')}</h3>
                      <p className="text-muted-foreground">{t('az.step4Desc', 'Indovina il cognome esatto per vincere! Puoi anche arrenderti e scoprire il calciatore misterioso.')}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Info database */}
              <div className="mt-2 pt-4 border-t-2 border-black mb-6">
                <h3 className="font-bold uppercase mb-3 flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  {t('setup.ilNostroDatabase')}
                </h3>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-background p-3 border-2 border-black">
                    <div className="text-2xl font-bold text-primary">6.330</div>
                    <div className="text-xs uppercase text-muted-foreground">{t('az.calciatori', 'Calciatori nel database')}</div>
                  </div>
                  <div className="bg-background p-3 border-2 border-black">
                    <div className="text-2xl font-bold text-primary">2000-2027</div>
                    <div className="text-xs uppercase text-muted-foreground">{t('az.serieA', 'Serie A')}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Selezione giocatori */}
            <div className="border-t-4 border-black pt-6">
              <h2 className="text-xl font-display font-bold uppercase mb-4 flex items-center gap-2">
                👥 {t('setup.giocatori')}
              </h2>

              <div className="space-y-2 mb-4">
                {players.map((player, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {index + 1}
                    </span>
                    <Input
                      value={player}
                      onChange={(e) => updatePlayerName(index, e.target.value)}
                      className="flex-1 border-2 border-black font-mono"
                      maxLength={20}
                    />
                    {players.length > 1 && (
                      <button
                        onClick={() => removePlayer(index)}
                        className="p-2 text-red-500 hover:text-red-700 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {players.length < 8 && (
                <div className="flex gap-2 mb-6">
                  <Input
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
                    placeholder={t('setup.nomeGiocatore', 'Nome giocatore...')}
                    className="flex-1 border-2 border-black font-mono"
                    maxLength={20}
                  />
                  <button
                    onClick={addPlayer}
                    className="px-4 py-2 bg-primary text-primary-foreground border-2 border-black font-bold hover:opacity-90 transition-opacity flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    {t('setup.aggiungi', 'Aggiungi')}
                  </button>
                </div>
              )}

              <button
                onClick={startGame}
                style={{
                  width: '100%',
                  padding: '1.5rem',
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  background: '#000',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
                  transition: 'all 0.2s'
                }}
              >
                ▶ {t('setup.iniziaPartita')}
              </button>
            </div>
          </div>

          <DonationProgress />
        </div>
      </div>
    </>
  );
}
