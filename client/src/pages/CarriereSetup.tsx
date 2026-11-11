import { useState } from 'react';
import { useLocation } from 'wouter';
import { NavigationBar } from '@/components/NavigationBar';
import { FeedbackModal } from '@/components/FeedbackModal';
import { DonationProgress } from "@/components/DonationProgress";
import { HelpCircle, Trophy } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useTranslation } from 'react-i18next';

type GameMode = 'maratona' | 'sfida';

export default function CarriereSetup() {
  const [, setLocation] = useLocation();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>('maratona');
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const { t } = useTranslation();
  
  // Query record Maratona
  const { data: marathonRecord } = trpc.leaderboard.getMaratonaRecord.useQuery();

  const startGame = () => {
    setLocation(`/carriere/${gameMode}`);
  };

  return (
    <>
      <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
      
      <div className="min-h-screen bg-background text-foreground p-4 font-mono">
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 mb-8">
            <h1 className="text-4xl font-display font-bold uppercase text-center mb-4 text-primary">
              CARRIERE
            </h1>
            
            <p className="text-center text-muted-foreground mb-6 font-bold uppercase tracking-widest text-sm">
              {t('carriere.sottotitolo')}<br /><br />
              {t('carriere.soloRitirati1')} <strong>{t('carriere.soloRitirati2')}</strong> {t('carriere.soloRitirati3')}
            </p>

            <div className="border-t-4 border-black pt-6">
              <button
                onClick={() => setIsHowToPlayOpen(!isHowToPlayOpen)}
                className="w-full text-left"
              >
                <h2 className="text-2xl font-display font-bold uppercase mb-6 flex items-center gap-2 hover:text-primary transition-colors cursor-pointer">
                  <HelpCircle className="h-6 w-6" />
                  {t('setup.comeSiGioca')}
                  <span className="ml-auto text-xl">{isHowToPlayOpen ? '▲' : '▼'}</span>
                </h2>
              </button>
              
              {isHowToPlayOpen && (
              <div className="space-y-4 text-sm">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">1</div>
                  <div>
                    <h3 className="font-bold uppercase">{t('carriere.step1Titolo')}</h3>
                    <p className="text-muted-foreground">{t('carriere.step1Desc')}</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">2</div>
                  <div>
                    <h3 className="font-bold uppercase">{t('carriere.step2Titolo')}</h3>
                    <p className="text-muted-foreground">{t('carriere.step2Desc')}</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">3</div>
                  <div>
                    <h3 className="font-bold uppercase">{t('carriere.step3Titolo')}</h3>
                    <p className="text-muted-foreground">{t('carriere.step3Desc')}</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">4</div>
                  <div>
                    <h3 className="font-bold uppercase">{t('carriere.step4Titolo')}</h3>
                    <p className="text-muted-foreground">{t('carriere.step4Desc')}</p>
                  </div>
                </div>
              </div>
              )}

              {/* Statistiche del database */}
              <div className="mt-6 pt-6 border-t-2 border-black">
                <h3 className="font-bold uppercase mb-3 flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  {t('setup.ilNostroDatabase')}
                </h3>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-background p-3 border-2 border-black">
                    <div className="text-sm md:text-lg font-bold text-primary leading-tight">{t('carriere.datiWikipedia')}</div>
                    <div className="text-xs uppercase text-muted-foreground">{t('carriere.giocatoriRitirati')}</div>
                  </div>
                  <div className="bg-background p-3 border-2 border-black">
                    <div className="text-2xl font-bold text-primary">2000-2025</div>
                    <div className="text-xs uppercase text-muted-foreground">{t('carriere.serieA')}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t-4 border-black pt-6 mt-6">
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: 'bold',
                color: '#333'
              }}>
                {t('setup.modalitaSelezionata')}:
              </label>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setGameMode('maratona')}
                  style={{
                    flex: '1 1 calc(50% - 0.5rem)',
                    padding: '1rem',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    border: `3px solid ${gameMode === 'maratona' ? '#ff5274' : '#ddd'}`,
                    background: gameMode === 'maratona' ? '#ff5274' : 'white',
                    color: gameMode === 'maratona' ? 'white' : '#333',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  🏃 {t('carriere.maratona')}
                </button>
                <button
                  onClick={() => setGameMode('sfida')}
                  style={{
                    flex: '1 1 calc(50% - 0.5rem)',
                    padding: '1rem',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    border: `3px solid ${gameMode === 'sfida' ? '#f5576c' : '#ddd'}`,
                    background: gameMode === 'sfida' ? '#f5576c' : 'white',
                    color: gameMode === 'sfida' ? 'white' : '#333',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  ⚡ {t('setup.sfida')}
                </button>
              </div>
              
              <div style={{ 
                marginTop: '1rem',
                padding: '1rem',
                background: gameMode === 'maratona' ? 'rgba(255, 82, 116, 0.05)' : 'rgba(245, 87, 108, 0.05)',
                borderRadius: '8px',
                fontSize: '0.9rem',
                color: '#64748b',
                lineHeight: '1.6'
              }}>
                {gameMode === 'maratona' ? (
                  <>
                    <strong>{t('carriere.maratonaModalita')}:</strong> {t('carriere.maratonaDesc')}
                    {marathonRecord && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 82, 116, 0.2)' }}>
                        <Trophy className="inline w-4 h-4 mr-1" style={{ color: '#ff5274' }} />
                        <strong>{t('carriere.recordAttuale')}:</strong> {marathonRecord.playerName} {t('carriere.con')} {marathonRecord.score} {marathonRecord.score === 1 ? t('carriere.giocatore') : t('home.giocatori')}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <strong>{t('carriere.sfidaModalita')}:</strong> {t('carriere.sfidaDesc')}
                  </>
                )}
              </div>
            </div>

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
                marginTop: '1.5rem',
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
