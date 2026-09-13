// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MemoryDetail from './MemoryDetail';
import api from '../lib/api';
vi.mock('../lib/api', () => ({ default: { get: vi.fn() } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner', role: 'owner' } }) }));
vi.mock('../context/DialogProvider', () => ({ useConfirm: () => vi.fn(), useToast: () => vi.fn() }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('memory detail loading', () => {
  it('renders a fetched photo then opens and closes fullscreen without crashing', async () => {
    let resolve;
    const response = new Promise(r => { resolve = r; });
    api.get.mockImplementation(path => path === '/memories/photo' ? response : Promise.resolve({data:{children:[]}}));
    render(<MemoryRouter initialEntries={['/memories/photo']} future={{v7_startTransition:true,v7_relativeSplatPath:true}}><Routes><Route path="/memories/:id" element={<MemoryDetail/>}/></Routes></MemoryRouter>);
    expect(screen.queryByRole('button',{name:'View photo full screen'})).toBeNull();
    await act(async () => { resolve({data:{memory:{id:'photo',familyId:'family',fileType:'photo',fileUrl:'https://example.com/photo.jpg',caption:'A family afternoon',capturedAt:'2026-09-01T12:00:00Z',uploadedById:'owner',uploadedBy:{name:'Parent'},reactions:[],comments:[],childIds:[],tags:[],ageLabels:[]}}}); });
    expect(screen.getByText('A family afternoon')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'View photo full screen'}));
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document,{key:'Escape'});
    expect(document.body.style.overflow).toBe('');
  });
});
it('opens video memories with muted inline autoplay and native controls', async () => {
  api.get.mockResolvedValue({data:{memory:{id:'video',fileType:'video',fileUrl:'https://example.com/video.mp4',capturedAt:'2026-09-01T12:00:00Z',uploadedById:'owner',reactions:[],comments:[]}}});
  const {container}=render(<MemoryRouter initialEntries={['/memories/video']} future={{v7_startTransition:true,v7_relativeSplatPath:true}}><Routes><Route path="/memories/:id" element={<MemoryDetail/>}/></Routes></MemoryRouter>);
  await waitFor(() => expect(container.querySelector('video')).toBeTruthy());
  expect(screen.queryByRole('button',{name:'Full screen'})).toBeNull();
  const player=container.querySelector('video');
  expect(player.autoplay).toBe(true);expect(player.muted).toBe(true);expect(player.playsInline).toBe(true);expect(player.controls).toBe(true);
});
