import { Link } from "react-router-dom";
import type { DashboardIdea } from "../../utils/dashboardIdeas";

export function IdeasPanel(props: { ideas: DashboardIdea[] }) {
  return (
    <article className="card dash-panel dash-ideas">
      <div className="chart-card-head">
        <div>
          <h2 className="section-title">Ideas for your next move</h2>
          <p className="muted chart-card-subtitle">Educational inspiration</p>
        </div>
      </div>
      <div className="dash-ideas-list">
        {props.ideas.map((idea) => (
          <div key={idea.id} className="dash-idea">
            <h3 className="dash-idea-title">{idea.title}</h3>
            <p className="dash-idea-body">{idea.body}</p>
            <Link to={idea.href} className="dash-idea-link">
              {idea.linkLabel}
            </Link>
          </div>
        ))}
      </div>
      <small className="dash-idea-disclaimer muted">
        Illustrative education only — not individualized investment advice or a
        product recommendation.
      </small>
    </article>
  );
}
