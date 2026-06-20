import { useCallback } from 'react';
import { useRecoilValue, useSetRecoilState, useResetRecoilState } from 'recoil';
import { replaceSpecialVars } from 'librechat-data-provider';
import { useChatContext, useChatFormContext, useAddedChatContext } from '~/Providers';
import { DEFAULT_INTENT_MESSAGE } from '~/components/Chat/Intent/constants';
import { useAuthContext } from '~/hooks/AuthContext';
import store from '~/store';

export default function useSubmitMessage() {
  const { user } = useAuthContext();
  const methods = useChatFormContext();
  const { conversation: addedConvo } = useAddedChatContext();
  const { ask, index, getMessages, setMessages } = useChatContext();
  const latestMessage = useRecoilValue(store.latestMessageFamily(index));

  const autoSendPrompts = useRecoilValue(store.autoSendPrompts);
  const setActivePrompt = useSetRecoilState(store.activePromptByIndex(index));

  const activeIntent = useRecoilValue(store.activeIntent);
  const resetIntent = useResetRecoilState(store.activeIntent);
  const resetIntentFunctions = useResetRecoilState(store.activeIntentFunctions);

  const submitMessage = useCallback(
    (data?: { text: string }) => {
      if (!data) {
        return console.warn('No data provided to submitMessage');
      }
      const rootMessages = getMessages();
      const isLatestInRootMessages = rootMessages?.some(
        (message) => message.messageId === latestMessage?.messageId,
      );
      if (!isLatestInRootMessages && latestMessage) {
        setMessages([...(rootMessages || []), latestMessage]);
      }

      // 意图选择器（Q4）：已选意图时允许空输入，文案兜底为「开始做吧」
      const text = !data.text?.trim() && activeIntent ? DEFAULT_INTENT_MESSAGE : data.text;

      ask(
        {
          text,
        },
        {
          addedConvo: addedConvo ?? undefined,
        },
      );
      methods.reset();
      // 意图为单条消息生效（Q5）：发送后重置
      if (activeIntent) {
        resetIntent();
        resetIntentFunctions();
      }
    },
    [
      ask,
      methods,
      addedConvo,
      setMessages,
      getMessages,
      latestMessage,
      activeIntent,
      resetIntent,
      resetIntentFunctions,
    ],
  );

  const submitPrompt = useCallback(
    (text: string) => {
      const parsedText = replaceSpecialVars({ text, user });
      if (autoSendPrompts) {
        submitMessage({ text: parsedText });
        return;
      }

      const currentText = methods.getValues('text');
      const newText = currentText.trim().length > 1 ? `\n${parsedText}` : parsedText;
      setActivePrompt(newText);
    },
    [autoSendPrompts, submitMessage, setActivePrompt, methods, user],
  );

  return { submitMessage, submitPrompt };
}
