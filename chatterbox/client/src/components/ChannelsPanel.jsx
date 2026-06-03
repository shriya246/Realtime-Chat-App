/**
 * Purpose: Provides simple WhatsApp-style channels and broadcasts UI.
 */

import { useEffect, useState } from 'react';
import { Radio, Search, X } from 'lucide-react';

import api, { getApiErrorMessage } from '../services/api';

const ChannelsPanel = ({ isOpen, onClose }) => {
  const [channels, setChannels] = useState([]);
  const [content, setContent] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [postContent, setPostContent] = useState('');
  const [search, setSearch] = useState('');
  const [selectedChannel, setSelectedChannel] = useState(null);

  const loadChannels = async (query = search) => {
    const response = await api.get('/channels', { params: query ? { search: query } : {} });
    setChannels(response.data.data.channels);
    setSelectedChannel((current) => current ? response.data.data.channels.find((channel) => channel.id === current.id) || current : response.data.data.channels[0] || null);
  };

  useEffect(() => {
    if (isOpen) {
      loadChannels('').catch((loadError) => setError(getApiErrorMessage(loadError, 'Unable to load channels.')));
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const createChannel = async (event) => {
    event.preventDefault();
    try {
      setError('');
      const response = await api.post('/channels', { description, name });
      setChannels((current) => [response.data.data.channel, ...current]);
      setSelectedChannel(response.data.data.channel);
      setDescription('');
      setName('');
    } catch (saveError) {
      setError(getApiErrorMessage(saveError, 'Unable to create channel.'));
    }
  };

  const toggleFollow = async (channel) => {
    const response = channel.isFollowing
      ? await api.delete(`/channels/${channel.id}/follow`)
      : await api.post(`/channels/${channel.id}/follow`);
    setSelectedChannel(response.data.data.channel);
    setChannels((current) => current.map((entry) => entry.id === channel.id ? response.data.data.channel : entry));
  };

  const createPost = async (event) => {
    event.preventDefault();
    try {
      const response = await api.post(`/channels/${selectedChannel.id}/posts`, { content: postContent });
      setSelectedChannel(response.data.data.channel);
      setChannels((current) => current.map((entry) => entry.id === selectedChannel.id ? response.data.data.channel : entry));
      setPostContent('');
    } catch (saveError) {
      setError(getApiErrorMessage(saveError, 'Unable to post to channel.'));
    }
  };

  const react = async (post, emoji) => {
    const response = await api.post(`/channels/${selectedChannel.id}/posts/${post._id || post.id}/reactions`, { emoji });
    setSelectedChannel((current) => ({
      ...current,
      posts: current.posts.map((entry) => (entry._id || entry.id) === (post._id || post.id) ? response.data.data.post : entry)
    }));
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
      <section className="grid max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-md border border-stroke bg-panel shadow-modal md:grid-cols-[320px_1fr]">
        <aside className="min-h-0 border-r border-stroke p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink"><Radio className="h-4 w-4" /> Channels</h2>
            <button aria-label="Close channels" className="icon-button" onClick={onClose} type="button">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form className="relative mb-4" onSubmit={(event) => { event.preventDefault(); loadChannels(search); }}>
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted" />
            <input aria-label="Search channels" className="field pl-9" onChange={(event) => setSearch(event.target.value)} placeholder="Search channels" value={search} />
          </form>
          <form className="mb-4 rounded-md border border-stroke bg-canvas p-3" onSubmit={createChannel}>
            <input aria-label="Channel name" className="field mb-2" onChange={(event) => setName(event.target.value)} placeholder="New channel name" value={name} />
            <input aria-label="Channel description" className="field" onChange={(event) => setDescription(event.target.value)} placeholder="Description" value={description} />
            <button className="primary-button mt-2 w-full" disabled={!name.trim()} type="submit">Create channel</button>
          </form>
          {error && <p className="mb-3 text-sm text-coral">{error}</p>}
          <div className="max-h-[44vh] overflow-y-auto">
            {channels.map((channel) => (
              <button className="mb-1 w-full rounded-md px-3 py-2 text-left hover:bg-raised" key={channel.id} onClick={() => setSelectedChannel(channel)} type="button">
                <span className="block text-sm font-semibold text-ink">{channel.name}</span>
                <span className="block truncate text-xs text-muted">{channel.followerCount} followers</span>
              </button>
            ))}
          </div>
        </aside>
        <main className="min-h-0 overflow-y-auto p-5">
          {selectedChannel ? (
            <>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-ink">{selectedChannel.name}</h3>
                  <p className="text-sm text-muted">{selectedChannel.description || 'No description yet.'}</p>
                </div>
                <button className="icon-button w-auto px-4" onClick={() => toggleFollow(selectedChannel)} type="button">
                  {selectedChannel.isFollowing ? 'Unfollow' : 'Follow'}
                </button>
              </div>
              {selectedChannel.myRole === 'admin' && (
                <form className="mb-4 rounded-md border border-stroke bg-canvas p-3" onSubmit={createPost}>
                  <textarea aria-label="Channel post" className="field min-h-20 py-2" onChange={(event) => setPostContent(event.target.value)} placeholder="Broadcast an update" value={postContent} />
                  <button className="primary-button mt-2" disabled={!postContent.trim()} type="submit">Post</button>
                </form>
              )}
              <div className="space-y-3">
                {(selectedChannel.posts || []).map((post) => (
                  <article className="rounded-md border border-stroke bg-canvas p-3" key={post._id || post.id}>
                    <p className="whitespace-pre-wrap text-sm text-ink">{post.content}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                        <button className="rounded border border-stroke px-2 py-1 text-sm" key={emoji} onClick={() => react(post, emoji)} type="button">
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">Create or select a channel.</p>
          )}
        </main>
      </section>
    </div>
  );
};

export default ChannelsPanel;
