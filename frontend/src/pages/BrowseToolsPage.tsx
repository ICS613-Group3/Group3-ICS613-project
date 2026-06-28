import { Link } from 'react-router-dom';
import { mockTools } from '../data/mockData';

function BrowseToolsPage() {
  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Browse & Search</p>
          <h1>Available Tools</h1>
          <p className="page-description">
            Search available neighborhood tools by category, condition, and date range.
            All reservation dates are interpreted in Hawaii Standard Time (HST).
          </p>
        </div>
      </div>

      <div className="filter-panel">
        <input type="text" placeholder="Search by tool name or keyword" />
        <select defaultValue="">
          <option value="">All categories</option>
          <option value="Power Tools">Power Tools</option>
          <option value="Garden">Garden</option>
          <option value="Kitchen">Kitchen</option>
          <option value="Ladders">Ladders</option>
          <option value="Other">Other</option>
        </select>
        <input type="date" aria-label="Start date" />
        <input type="date" aria-label="End date" />
        <button type="button">Apply Filters</button>
      </div>

      <div className="tool-grid">
        {mockTools.map((tool) => (
          <article className="tool-card" key={tool.id}>
            <img src={tool.imageUrl} alt={tool.name} className="tool-image" />

            <div className="tool-card-body">
              <div className="tool-card-top">
                <span className="status-badge">{tool.category}</span>
                <span className="rating">? {tool.rating}</span>
              </div>

              <h2>{tool.name}</h2>
              <p>{tool.description}</p>

              <dl className="tool-meta">
                <div>
                  <dt>Owner</dt>
                  <dd>{tool.ownerName}</dd>
                </div>
                <div>
                  <dt>Condition</dt>
                  <dd>{tool.condition}</dd>
                </div>
                <div>
                  <dt>Availability</dt>
                  <dd>{tool.availability}</dd>
                </div>
                <div>
                  <dt>Latest return</dt>
                  <dd>{tool.latestReturnTime} HST</dd>
                </div>
              </dl>

              <Link className="primary-link" to={`/tools/${tool.id}`}>
                View Details
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default BrowseToolsPage;
