
import React from 'react';
import {connect} from 'react-redux';

function WorkspaceSelector (state) {
  const {
    views: {
      CipheredText, Decryption, DecipheredText, Hints, HintRequestFeedback,
      Substitution, EditSubstitution, BigramFrequencyAnalysis
    },
  } = state;

  return {
    CipheredText, Decryption, DecipheredText, Hints, HintRequestFeedback,
    Substitution, EditSubstitution, BigramFrequencyAnalysis,
  };
}

class Workspace extends React.PureComponent {
  render () {
    const {
      CipheredText, Decryption, DecipheredText, Hints, HintRequestFeedback,
      Substitution, EditSubstitution, BigramFrequencyAnalysis,
    } = this.props;
    return (
      <div>
        <br />
        <h2>Message chiffré</h2>
        <CipheredText />
        <h2>Clé de déchiffrement</h2>
        <div className='panel-body'>
          <Decryption />
        </div>
        <Hints />
        <HintRequestFeedback />
        <h2>Substitutions de bigrammes générés</h2>
        <div className='panel-body'>
          <Substitution />
        </div>
        <h2>Application des substitutions générées et ajout manuel</h2>
        <EditSubstitution nbLettersPerRow={29} />
        <h2>Bigrammes les plus fréquents</h2>
        <div className='panel-body'>
          <BigramFrequencyAnalysis
            editable={false}
            nBigrams={10} />
        </div>
        <h2>Message déchiffré</h2>
        <div className='panel-body'>
          <DecipheredText />
        </div>
      </div>
    );
  }

}

export default {
  views: {
    Workspace: connect(WorkspaceSelector)(Workspace)
  }
};
