import debounce from 'lodash/debounce';
import { useEffect, useMemo, useRef, useCallback } from 'react';
import { useRecoilValue, useRecoilState } from 'recoil';
import type { TEndpointOption } from 'librechat-data-provider';
import type { KeyboardEvent } from 'react';
import type { IntentPromptContext } from '~/components/Chat/Intent/promptTemplates';
import {
  forceResize,
  insertTextAtCursor,
  getEntityName,
  getEntity,
  checkIfScrollable,
} from '~/utils';
import { getIntentByKey } from '~/components/Chat/Intent/constants';
import { buildIntentPrompt } from '~/components/Chat/Intent/promptTemplates';
import { useAssistantsMapContext } from '~/Providers/AssistantsMapContext';
import { useAgentsMapContext } from '~/Providers/AgentsMapContext';
import { useProfileProductsQuery } from '~/data-provider/Profile';
import useGetSender from '~/hooks/Conversations/useGetSender';
import useFileHandling from '~/hooks/Files/useFileHandling';
import { useInteractionHealthCheck } from '~/data-provider';
import { useChatFormContext } from '~/Providers';
import { useChatContext } from '~/Providers/ChatContext';
import { globalAudioId } from '~/common';
import { useLocalize } from '~/hooks';
import store from '~/store';

type KeyEvent = KeyboardEvent<HTMLTextAreaElement>;

export default function useTextarea({
  textAreaRef,
  submitButtonRef,
  setIsScrollable,
  disabled = false,
}: {
  textAreaRef: React.RefObject<HTMLTextAreaElement>;
  submitButtonRef: React.RefObject<HTMLButtonElement>;
  setIsScrollable: React.Dispatch<React.SetStateAction<boolean>>;
  disabled?: boolean;
}) {
  const localize = useLocalize();
  const getSender = useGetSender();
  const isComposing = useRef(false);
  const agentsMap = useAgentsMapContext();
  const { handleFiles } = useFileHandling();
  const assistantMap = useAssistantsMapContext();
  const checkHealth = useInteractionHealthCheck();
  const enterToSend = useRecoilValue(store.enterToSend);

  const { index, conversation, isSubmitting, filesLoading, setFilesLoading } = useChatContext();
  const latestMessage = useRecoilValue(store.latestMessageFamily(index));
  const [activePrompt, setActivePrompt] = useRecoilState(store.activePromptByIndex(index));
  const methods = useChatFormContext();
  const activeIntent = useRecoilValue(store.activeIntent);
  const activeIntentFunctions = useRecoilValue(store.activeIntentFunctions);
  const activeBrandId = useRecoilValue(store.activeBrandId);
  const activeProductId = useRecoilValue(store.activeProductId);
  const activeProductName = useRecoilValue(store.activeProductName);
  const activeBrandName = useRecoilValue(store.activeBrandName);
  const lastInjectedIntentPromptRef = useRef<string | null>(null);

  const { data: products } = useProfileProductsQuery(activeBrandId, {
    enabled: activeBrandId != null && activeIntent != null,
  });

  const intentPromptContext = useMemo<IntentPromptContext>(() => {
    const product =
      products?.find((p) => p.id === activeProductId) ??
      products?.find((p) => p.is_primary) ??
      products?.[0];
    const sellingPoints = product?.product_attributes?.length
      ? product.product_attributes.join('、')
      : undefined;
    return {
      productName: activeProductName ?? product?.product_name ?? activeBrandName ?? undefined,
      sellingPoints,
      targetCustomers: product?.target_customers ?? undefined,
    };
  }, [products, activeProductId, activeProductName, activeBrandName]);

  const { endpoint = '' } = conversation || {};
  const { entity, isAgent, isAssistant } = getEntity({
    endpoint,
    agentsMap,
    assistantMap,
    agent_id: conversation?.agent_id,
    assistant_id: conversation?.assistant_id,
  });
  const entityName = entity?.name ?? '';

  const isNotAppendable = latestMessage?.error === true && !isAssistant;
  // && (conversationId?.length ?? 0) > 6; // also ensures that we don't show the wrong placeholder

  useEffect(() => {
    const prompt = activePrompt ?? '';
    if (prompt && textAreaRef.current) {
      insertTextAtCursor(textAreaRef.current, prompt);
      forceResize(textAreaRef.current);
      setActivePrompt(undefined);
    }
  }, [activePrompt, setActivePrompt, textAreaRef]);

  useEffect(() => {
    const el = textAreaRef.current;
    if (!el) {
      return;
    }

    if (activeIntent == null) {
      if (
        lastInjectedIntentPromptRef.current != null &&
        el.value === lastInjectedIntentPromptRef.current
      ) {
        methods.setValue('text', '', { shouldValidate: true });
        forceResize(el);
      }
      lastInjectedIntentPromptRef.current = null;
      return;
    }

    const nextPrompt = buildIntentPrompt(activeIntent, activeIntentFunctions, intentPromptContext);
    if (nextPrompt == null || el.value === nextPrompt) {
      lastInjectedIntentPromptRef.current = nextPrompt ?? lastInjectedIntentPromptRef.current;
      return;
    }

    const isClean = el.value === '' || el.value === lastInjectedIntentPromptRef.current;
    if (!isClean) {
      return;
    }

    methods.setValue('text', nextPrompt, { shouldValidate: true });
    forceResize(el);
    lastInjectedIntentPromptRef.current = nextPrompt;
  }, [activeIntent, activeIntentFunctions, intentPromptContext, methods, textAreaRef]);

  useEffect(() => {
    const currentValue = textAreaRef.current?.value ?? '';
    if (currentValue) {
      return;
    }

    const getPlaceholderText = () => {
      if (disabled) {
        return localize('com_endpoint_config_placeholder');
      }
      const currentEndpoint = conversation?.endpoint ?? '';
      const currentAgentId = conversation?.agent_id ?? '';
      const currentAssistantId = conversation?.assistant_id ?? '';
      if (isAgent && (!currentAgentId || !agentsMap?.[currentAgentId])) {
        return localize('com_endpoint_agent_placeholder');
      } else if (
        isAssistant &&
        (!currentAssistantId || !assistantMap?.[currentEndpoint]?.[currentAssistantId])
      ) {
        return localize('com_endpoint_assistant_placeholder');
      }

      if (isNotAppendable) {
        return localize('com_endpoint_message_not_appendable');
      }

      const selectedIntent = activeIntent ? getIntentByKey(activeIntent) : undefined;
      if (selectedIntent) {
        return localize('com_intent_input_placeholder', {
          0: localize(selectedIntent.labelKey),
        });
      }

      const sender =
        isAssistant || isAgent
          ? getEntityName({ name: entityName, isAgent, localize })
          : getSender(conversation as TEndpointOption);

      return `${localize('com_endpoint_message_new', {
        0: sender ? sender : localize('com_endpoint_ai'),
      })}`;
    };

    const placeholder = getPlaceholderText();

    if (textAreaRef.current?.getAttribute('placeholder') === placeholder) {
      return;
    }

    const setPlaceholder = () => {
      const placeholder = getPlaceholderText();

      if (textAreaRef.current?.getAttribute('placeholder') !== placeholder) {
        textAreaRef.current?.setAttribute('placeholder', placeholder);
        forceResize(textAreaRef.current);
      }
    };

    const debouncedSetPlaceholder = debounce(setPlaceholder, 80);
    debouncedSetPlaceholder();

    return () => debouncedSetPlaceholder.cancel();
  }, [
    isAgent,
    localize,
    disabled,
    getSender,
    agentsMap,
    entityName,
    textAreaRef,
    isAssistant,
    assistantMap,
    conversation,
    latestMessage,
    isNotAppendable,
    activeIntent,
  ]);

  const handleKeyDown = useCallback(
    (e: KeyEvent) => {
      if (textAreaRef.current && checkIfScrollable(textAreaRef.current)) {
        const scrollable = checkIfScrollable(textAreaRef.current);
        scrollable && setIsScrollable(scrollable);
      }
      if (e.key === 'Enter' && isSubmitting) {
        return;
      }

      checkHealth();

      const isNonShiftEnter = e.key === 'Enter' && !e.shiftKey;
      const isCtrlEnter = e.key === 'Enter' && (e.ctrlKey || e.metaKey);

      // NOTE: isComposing and e.key behave differently in Safari compared to other browsers, forcing us to use e.keyCode instead
      const isComposingInput = isComposing.current || e.key === 'Process' || e.keyCode === 229;

      if (isNonShiftEnter && filesLoading) {
        e.preventDefault();
      }

      if (isNonShiftEnter) {
        e.preventDefault();
      }

      if (
        e.key === 'Enter' &&
        !enterToSend &&
        !isCtrlEnter &&
        textAreaRef.current &&
        !isComposingInput
      ) {
        e.preventDefault();
        insertTextAtCursor(textAreaRef.current, '\n');
        forceResize(textAreaRef.current);
        return;
      }

      if ((isNonShiftEnter || isCtrlEnter) && !isComposingInput) {
        const globalAudio = document.getElementById(globalAudioId) as HTMLAudioElement | undefined;
        if (globalAudio) {
          console.log('Unmuting global audio');
          globalAudio.muted = false;
        }
        submitButtonRef.current?.click();
      }
    },
    [
      isSubmitting,
      checkHealth,
      filesLoading,
      enterToSend,
      setIsScrollable,
      textAreaRef,
      submitButtonRef,
    ],
  );

  const handleCompositionStart = () => {
    isComposing.current = true;
  };

  const handleCompositionEnd = () => {
    isComposing.current = false;
  };

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const textArea = textAreaRef.current;
      if (!textArea) {
        return;
      }

      const clipboardData = e.clipboardData as DataTransfer | undefined;
      if (!clipboardData) {
        return;
      }

      if (clipboardData.files.length > 0) {
        setFilesLoading(true);
        const timestampedFiles: File[] = [];
        for (const file of clipboardData.files) {
          const newFile = new File([file], `clipboard_${+new Date()}_${file.name}`, {
            type: file.type,
          });
          timestampedFiles.push(newFile);
        }
        handleFiles(timestampedFiles);
      }
    },
    [handleFiles, setFilesLoading, textAreaRef],
  );

  return {
    textAreaRef,
    handlePaste,
    handleKeyDown,
    isNotAppendable,
    handleCompositionEnd,
    handleCompositionStart,
  };
}
