import { useParams } from 'react-router-dom';
import { MaterialViewer } from '../../features/materials';

export function MaterialPage() {
  const { materialId = '' } = useParams();
  return <MaterialViewer key={materialId} materialId={materialId} />;
}
