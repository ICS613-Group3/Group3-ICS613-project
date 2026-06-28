import { Link } from 'react-router-dom';

const sampleTools = [
  {
    id: 'tool-1',
    name: 'Cordless Drill',
    category: 'Power Tools',
    condition: 'Good',
    owner: 'Demo Owner',
    status: 'Available',
  },
  {
    id: 'tool-2',
    name: 'Garden Shovel',
    category: 'Garden',
    condition: 'Like New',
    owner: 'Tool Owner',
    status: 'Available',
  },
  {
    id: 'tool-3',
    name: 'Step Ladder',
    category: 'Ladders',
    condition: 'Fair',
    owner: 'Neighborhood Member',
    status: 'Available',
  },
];

function BrowseToolsPage() {
  return (
    <section className="page-stack">
      <div className="page-card">
        <p className="eyebrow">Tool Catalog</p>
        <h2>Browse and Search Tools</h2>
        <p>
          Placeholder browse page for searching tools by keyword, category, and reservation date
          range.
        </p>

        <div className="filter-row">
          <input type="search" placeholder="Search tools" />
          <select aria-label="Filter by category">
            <option>All categories</option>
            <option>Power Tools</option>
            <option>Garden</option>
            <option>Kitchen</option>
            <option>Ladders</option>
            <option>Other</option>
          </select>
          <input type="date" aria-label="Start date" />
          <input type="date" aria-label="End date" />
        </div>
      </div>

      <div className="card-grid">
        {sampleTools.map((tool) => (
          <article className="tool-card" key={tool.id}>
            <div className="tool-thumbnail">Tool Photo</div>
            <h3>{tool.name}</h3>
            <p>{tool.category}</p>
            <p>Condition: {tool.condition}</p>
            <p>Owner: {tool.owner}</p>
            <span className="status-badge">{tool.status}</span>
            <Link className="button-link" to={`/tools/${tool.id}`}>
              View Details
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

export default BrowseToolsPage;
