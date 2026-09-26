import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { englishMessages } from '../../localization/messages';
import { privacyNoticeUrl, supportEmail } from './contactDetails';
import { PrivacyNoticeLink, SupportContact } from './SupportContact';

afterEach(() => jest.restoreAllMocks());

it('opens an editable email only on request with the displayed reference safely encoded', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const reference = 'synthetic-reference&bcc=other@example.test';
  const view = await render(<SupportContact topic="purchase" reference={reference} />);
  expect(open).not.toHaveBeenCalled();
  expect(view.getByText(englishMessages.purchases.supportReference(reference))).toHaveProp(
    'selectable',
    true,
  );
  await fireEvent.press(view.getByRole('button', { name: englishMessages.support.emailSupport }));
  await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
  const url = new URL(open.mock.calls[0]![0]);
  expect(url.protocol).toBe('mailto:');
  expect(url.pathname).toBe(supportEmail);
  expect([...url.searchParams.keys()]).toEqual(['subject', 'body']);
  expect(url.searchParams.get('subject')).toBe(englishMessages.support.subjects.purchase);
  expect(url.searchParams.get('body')).toBe(
    `${englishMessages.support.emailBody}\n\n${englishMessages.purchases.supportReference(reference)}`,
  );
});

it('keeps a selectable address and allows retry when no email app can open the draft', async () => {
  const open = jest
    .spyOn(Linking, 'openURL')
    .mockRejectedValueOnce(new Error('private native detail'))
    .mockResolvedValueOnce(undefined);
  const view = await render(<SupportContact />);
  await fireEvent.press(view.getByRole('button', { name: englishMessages.support.emailSupport }));
  await view.findByText(englishMessages.support.openFailed);
  expect(view.getByText(supportEmail)).toHaveProp('selectable', true);
  expect(view.queryByText('private native detail')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: englishMessages.support.emailSupport }));
  await waitFor(() => expect(open).toHaveBeenCalledTimes(2));
  expect(view.queryByText(englishMessages.support.openFailed)).toBeNull();
  expect(new URL(open.mock.calls[1]![0]).searchParams.get('body')).toBe(
    englishMessages.support.emailBody,
  );
});

it('opens the published privacy policy only on request', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const view = await render(<PrivacyNoticeLink />);
  expect(open).not.toHaveBeenCalled();
  await fireEvent.press(view.getByRole('button', { name: englishMessages.support.privacyPolicy }));
  await waitFor(() => expect(open).toHaveBeenCalledWith(privacyNoticeUrl));
});
