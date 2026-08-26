import { getProducts, updateProduct } from './lib/db';

const targetProducts = [
  { name: 'BATERIA 9V RECARGABLE', img: 'https://images.unsplash.com/photo-1620054705141-8e9a26372551?auto=format&fit=crop&q=80&w=200' },
  { name: 'BORNE BATERIA ARDUINO', img: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=200' },
  { name: 'PROTOBOARD 400 PUNTOS', img: 'https://images.unsplash.com/photo-1517077304055-6e89abbf09b0?auto=format&fit=crop&q=80&w=200' },
  { name: 'DIODO LED COLORES', img: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=200' },
  { name: 'RESISTENCIAS 1/4W', img: 'https://images.unsplash.com/photo-1588508065123-287b28e0141c?auto=format&fit=crop&q=80&w=200' },
  { name: 'MULTIMETRO ANEG', img: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&q=80&w=200' },
  { name: 'ARDUINO UNO C-CABLE', img: 'https://images.unsplash.com/photo-1553406830-ef2513450d76?auto=format&fit=crop&q=80&w=200' },
  { name: 'SERVO S690', img: 'https://images.unsplash.com/photo-1580983546522-a2928509e53f?auto=format&fit=crop&q=80&w=200' },
  { name: 'PARLANTE 0,5W 8OHM', img: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&q=80&w=200' }
];

async function updateImages() {
  console.log('Iniciando actualizacion de imagenes...');
  try {
    const existingProducts = await getProducts();
    let updatedCount = 0;
    
    for (const target of targetProducts) {
      const match = existingProducts.find(p => p.name.trim().toLowerCase() === target.name.trim().toLowerCase());
      if (match) {
        await updateProduct(match.id, { imageUrl: target.img });
        console.log(`Actualizado: ${target.name}`);
        updatedCount++;
      }
    }
    console.log(`¡Actualización completa! Se actualizaron ${updatedCount} productos.`);
  } catch (error) {
    console.error('Error al actualizar:', error);
  }
  process.exit(0);
}

updateImages();
