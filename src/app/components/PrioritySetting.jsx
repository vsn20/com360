import { cookies } from 'next/headers';
import { getAllFeatures, savePriorities } from '@/app/serverActions/priorityAction';

const decodeJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

export default async function PrioritySetting() {
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;
  const decoded = token ? decodeJwt(token) : null;
  const orgid = decoded?.orgid || null;

  const { success, features, error } = await getAllFeatures();
  if (!success) {
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <p>Error: {error}</p>
      </div>
    );
  }

  const items = [];
  features.forEach(feature => {
    if (feature.C_SUBMENU && feature.C_SUBMENU.length > 0) {
      feature.C_SUBMENU.forEach(C_SUBMENU => {
        items.push({
          id: C_SUBMENU.id,
          type: 'C_SUBMENU',
          parentId: feature.id,
          parentName: feature.name,
          name: C_SUBMENU.name,
          uniqueKey: `submenu-${feature.id}-${C_SUBMENU.id}`,
        });
      });
    } else {
      items.push({
        id: feature.id,
        type: 'C_MENU',
        name: feature.name,
        uniqueKey: `menu-${feature.id}`,
      });
    }
  });

  let initialPriorities = {};
  if (orgid && features) {
    features.forEach(feature => {
      initialPriorities[feature.id] = 1;
      if (feature.C_SUBMENU) {
        feature.C_SUBMENU.forEach(C_SUBMENU => {
          initialPriorities[C_SUBMENU.id] = 1;
        });
      }
    });
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>Priority Settings</h2>
      <form action={savePriorities}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Item</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Priority</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.uniqueKey}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  {item.type === 'C_SUBMENU' ? `${item.parentName} > ${item.name}` : item.name}
                  <input type="hidden" name={`${item.id}_type`} value={item.type} />
                </td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  <input
                    type="number"
                    name={item.id}
                    defaultValue={initialPriorities[item.id] || 1}
                    min="1"
                    style={{ width: '60px' }}
                    required
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="submit"
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            backgroundColor: '#0FD46C',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Save Priorities
        </button>
      </form>
    </div>
  );
}