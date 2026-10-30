import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  calculateOptimalDimensions, 
  isImageFile, 
  isPdfFile, 
  formatFileSize,
  optimizeImageForOCR,
  prepareOptimizedMediaForGemini
} from '../src/lib/imageOptimizer.ts';
import { AVAILABLE_FREE_GEMINI_MODELS, getGeminiModelName } from '../src/lib/geminiService.ts';

describe('Audit Performance & Optimisation Téléversement Tickets PNG', () => {

  it('1. REDIMENSIONNEMENT GÉOMÉTRIQUE : Maintient strictement le ratio d aspect sans déformation', () => {
    // Cas 1 : Image déjà dans les limites maximales (1200 x 1600 <= 1800 x 2600)
    const withinBounds = calculateOptimalDimensions(1200, 1600, 1800, 2600);
    assert.equal(withinBounds.scaled, false);
    assert.equal(withinBounds.width, 1200);
    assert.equal(withinBounds.height, 1600);

    // Cas 2 : Photo large 4K (4000 x 3000) -> Largeur max 1800, Hauteur proportionnelle 1350
    const wideImage = calculateOptimalDimensions(4000, 3000, 1800, 2600);
    assert.equal(wideImage.scaled, true);
    assert.equal(wideImage.width, 1800);
    assert.equal(wideImage.height, 1350);
    // Vérification du ratio : 4000/3000 = 1.3333... et 1800/1350 = 1.3333...
    assert.ok(Math.abs((4000 / 3000) - (wideImage.width / wideImage.height)) < 0.01);

    // Cas 3 : Ticket de caisse très long (1500 x 5200) -> Hauteur max 2600, Largeur proportionnelle 750
    const tallReceipt = calculateOptimalDimensions(1500, 5200, 1800, 2600);
    assert.equal(tallReceipt.scaled, true);
    assert.equal(tallReceipt.height, 2600);
    assert.equal(tallReceipt.width, 750);
    assert.ok(Math.abs((1500 / 5200) - (tallReceipt.width / tallReceipt.height)) < 0.01);

    // Cas 4 : Cas limites
    const zeroBounds = calculateOptimalDimensions(0, 0, 1800, 2600);
    assert.equal(zeroBounds.scaled, false);
    assert.equal(zeroBounds.width, 1800);
    assert.equal(zeroBounds.height, 2600);
  });

  it('2. DÉTECTION DES FORMATS : Identifie les PNG, JPG, WebP et isole les PDF', () => {
    assert.equal(isImageFile({ type: 'image/png', name: 'ticket_intermarche.png' }), true);
    assert.equal(isImageFile({ type: 'image/jpeg', name: 'scan_leclerc.jpg' }), true);
    assert.equal(isImageFile({ type: 'image/webp', name: 'photo.webp' }), true);
    assert.equal(isImageFile({ type: '', name: 'TICKET_SUPER_U.PNG' }), true);

    // PDF ne doit PAS être considéré comme une image à pixelliser sur canvas
    assert.equal(isImageFile({ type: 'application/pdf', name: 'ticket_digital.pdf' }), false);
    assert.equal(isPdfFile({ type: 'application/pdf', name: 'facture.pdf' }), true);
    assert.equal(isPdfFile({ type: 'image/png', name: 'ticket.png' }), false);
  });

  it('3. FORMATAGE DE TAILLE : Affiche les Ko et Mo avec précision', () => {
    assert.equal(formatFileSize(0), '0 Ko');
    assert.equal(formatFileSize(512 * 1024), '512 Ko');
    assert.equal(formatFileSize(1.5 * 1024 * 1024), '1.5 Mo');
    assert.equal(formatFileSize(15.2 * 1024 * 1024), '15.2 Mo');
  });

  it('4. CASCADE MODÈLES GEMINI : Éradication totale du modèle fantôme gemini-3.8-flash', () => {
    // Vérification que les modèles officiels disponibles sont bien listés
    const modelIds = AVAILABLE_FREE_GEMINI_MODELS.map(m => m.id);
    assert.ok(modelIds.includes('gemini-2.5-flash'));
    assert.ok(modelIds.includes('gemini-flash-latest'));
    assert.ok(modelIds.includes('gemini-2.0-flash'));

    // Interdiction formelle du modèle inexistant
    assert.ok(!modelIds.includes('gemini-3.8-flash'));
    assert.ok(!modelIds.includes('gemini-3.5-flash'));

    // Le modèle par défaut doit être valide et ultra-rapide (~1s)
    const defaultModel = getGeminiModelName();
    assert.equal(defaultModel, 'gemini-2.5-flash');
  });

  it('5. PREPARATION MULTIMODALE : Traite les fichiers et génère un payload conforme inlineData', async () => {
    // Création d'un mock Blob simulant un fichier image
    const mockBlob = new Blob(['Mock image binary content for receipt test'], { type: 'image/png' });
    const mockFile = new File([mockBlob], 'ticket_caise_test.png', { type: 'image/png' });

    let progressCalled = false;
    const progressCallback = (msg: string) => {
      progressCalled = true;
      assert.ok(msg.length > 0);
    };

    const prepared = await prepareOptimizedMediaForGemini([mockFile], progressCallback);

    assert.equal(prepared.length, 1);
    assert.ok(prepared[0].inlineData);
    assert.ok(typeof prepared[0].inlineData.data === 'string');
    assert.ok(prepared[0].meta);
    assert.equal(progressCalled, true);
  });

  it('6. PRESERVATION PDF : Un ticket PDF n est pas converti en JPEG et conserve son type MIME pur', async () => {
    const mockPdfBlob = new Blob(['%PDF-1.4 Mock PDF receipt stream'], { type: 'application/pdf' });
    const mockPdfFile = new File([mockPdfBlob], 'e_ticket_carrefour.pdf', { type: 'application/pdf' });

    const result = await optimizeImageForOCR(mockPdfFile);
    assert.equal(result.mimeType, 'application/pdf');
    assert.equal(result.isOptimized, false);
    assert.ok(result.base64.length > 0);
  });
});
