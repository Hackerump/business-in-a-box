export default function ConfirmDialog({ open, title, message, onConfirm, onCancel }) {
    if (!open) return null;

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-card" onClick={e => e.stopPropagation()}>
                <h3>{title}</h3>
                <p>{message}</p>
                <div className="modal-actions">
                    <button className="btn-sm btn-cancel" onClick={onCancel}>Cancel</button>
                    <button className="btn-sm btn-delete" onClick={onConfirm}>Delete</button>
                </div>
            </div>
        </div>
    );
}
